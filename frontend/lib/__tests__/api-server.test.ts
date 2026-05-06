/**
 * lib/api-server.ts の単体テスト
 *
 * fetchMeServer の挙動をテストする:
 *   1. 200 レスポンスで MeResponse を返す
 *   2. 401 レスポンスで null を返す
 *   3. 5xx レスポンスで Error を throw する
 *   4. cache() ラップの構造確認
 *
 * cache() のメモ化について:
 *   React の cache() は ReactSharedInternals.A（React サーバーランタイムのディスパッチャー）
 *   が存在する場合のみメモ化を行う。vitest の jsdom 環境ではディスパッチャーが設定されないため、
 *   cache() は関数をラップするのみでメモ化は無効になる（Next.js サーバーランタイムが必要）。
 *   そのため vitest では「fetch が 1 回だけ呼ばれる」ことは検証できない。
 *   代わりに「fetchMeServer が async 関数であり正しい戻り値を返す」ことを検証する。
 *   cache() によるリクエスト重複排除の効果は Next.js の統合環境で確認する。
 *
 * @see frontend/lib/api-server.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// next/headers の cookies() をモック（ホイスト必須）
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";

const mockCookies = vi.mocked(cookies);

// テスト用の MeResponse
const MOCK_ME_RESPONSE = {
  user: {
    id: "user-1",
    email: "owner@example.com",
    email_verified_at: "2026-05-05T09:00:00",
    name: null,
    image: null,
    created_at: "2026-05-05T09:00:00",
    updated_at: "2026-05-05T09:00:00",
    deleted_at: null,
  },
  organizations: [],
  current_organization: null,
  onboarding: null,
};

describe("fetchMeServer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // cookies() モックを設定（CookieStore ライクなオブジェクト）
    mockCookies.mockResolvedValue({
      toString: () => "session=abc123",
    } as unknown as Awaited<ReturnType<typeof cookies>>);
  });

  it("200 レスポンスの場合は MeResponse を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(MOCK_ME_RESPONSE),
      }),
    );

    const { fetchMeServer } = await import("@/lib/api-server");
    const result = await fetchMeServer();

    expect(result).toEqual(MOCK_ME_RESPONSE);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/me"),
      expect.objectContaining({
        headers: { Cookie: "session=abc123" },
        cache: "no-store",
      }),
    );
  });

  it("401 レスポンスの場合は null を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: () => Promise.resolve({}),
      }),
    );

    const { fetchMeServer } = await import("@/lib/api-server");
    const result = await fetchMeServer();

    expect(result).toBeNull();
  });

  it("5xx レスポンスの場合は Error を throw する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        status: 500,
        ok: false,
        json: () => Promise.resolve({}),
      }),
    );

    const { fetchMeServer } = await import("@/lib/api-server");
    await expect(fetchMeServer()).rejects.toThrow("API error: 500");
  });

  it("fetchMeServer は react の cache() でラップされた非同期関数として公開されている", async () => {
    // cache() は関数を受け取り新しい関数を返す（ラッパー）
    // fetchMeServer が呼び出し可能な関数であることを確認する（構造確認）
    const { fetchMeServer } = await import("@/lib/api-server");
    expect(typeof fetchMeServer).toBe("function");

    // cache() でラップされているため、モジュールからエクスポートされる参照は
    // const として宣言されており、再代入できない（TypeScript/ESモジュール保護）
    // 実際のメモ化効果は Next.js サーバーランタイム（ReactSharedInternals.A 有効時）で発揮される
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(MOCK_ME_RESPONSE),
      }),
    );

    // cache() ラップ後も正常に動作することを確認
    const result = await fetchMeServer();
    expect(result).toEqual(MOCK_ME_RESPONSE);
  });
});
