/**
 * app/page.tsx の単体テスト（ルートの状態分岐）
 *
 * テスト対象:
 *   - 未認証（session === null）→ ランディングページを描画
 *   - fetchMeServer が null（401）→ ランディングページを描画
 *   - 認証済み + 店舗未所属（organizations: []）→ /onboarding にリダイレクト
 *   - 認証済み + 店舗所属あり（organizations: [...]）→ /schedule にリダイレクト
 *
 * fetchMeServer と auth をモックして状態を制御する。
 * redirect() はテスト環境では vi.fn() でモックされているため、
 * page.tsx 内で redirect 後に return して後続処理を止めている。
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-design.md §5.3, §7.1
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";

// redirect は test/setup.ts でグローバルモック済み
const mockRedirect = vi.mocked(redirect);

// auth をモック（静的インポート前にホイスト）
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// fetchMeServer をモック（静的インポート前にホイスト）
vi.mock("@/lib/api-server", () => ({
  fetchMeServer: vi.fn(),
}));

import { auth } from "@/auth";
import { fetchMeServer } from "@/lib/api-server";
import Home from "@/app/page";
import type { MeResponse } from "@/lib/types";

const mockAuth = vi.mocked(auth);
const mockFetchMeServer = vi.mocked(fetchMeServer);

// テスト用の MeResponse ヘルパー
function makeMeResponse(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
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
    ...overrides,
  };
}

function makeOrganizationMembership() {
  return {
    organization: {
      id: "org-1",
      name: "テスト店舗",
      slug: "abc123def456",
      created_at: "2026-05-05T10:00:00",
      updated_at: "2026-05-05T10:00:00",
      deleted_at: null,
    },
    role: "owner" as const,
    joined_at: "2026-05-05T10:00:00",
  };
}

describe("Home (app/page.tsx) の状態分岐", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockFetchMeServer.mockReset();
    mockRedirect.mockReset();
  });

  it("未認証（session === null）の場合はランディングページを描画する", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const ui = await Home();
    render(ui);

    expect(
      screen.getByRole("heading", { level: 1, name: /シフト作りに/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^無料で始める/ })).toHaveAttribute(
      "href",
      "/signin",
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("fetchMeServer が null（401）を返す場合もランディングページを描画する", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1", email: "owner@example.com" },
      expires: "2099-01-01",
    });
    mockFetchMeServer.mockResolvedValueOnce(null);

    const ui = await Home();
    render(ui);

    expect(
      screen.getByRole("heading", { level: 1, name: /シフト作りに/ }),
    ).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("認証済み + 店舗未所属（organizations: []）の場合は /onboarding にリダイレクトする", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1", email: "owner@example.com" },
      expires: "2099-01-01",
    });
    mockFetchMeServer.mockResolvedValueOnce(
      makeMeResponse({ organizations: [] }),
    );

    await Home();

    expect(mockRedirect).toHaveBeenCalledWith("/onboarding");
    expect(mockRedirect).not.toHaveBeenCalledWith("/schedule");
  });

  it("認証済み + 店舗所属あり（organizations: [...]）の場合は /schedule にリダイレクトする", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1", email: "owner@example.com" },
      expires: "2099-01-01",
    });
    const org = makeOrganizationMembership();
    mockFetchMeServer.mockResolvedValueOnce(
      makeMeResponse({
        organizations: [org],
        current_organization: {
          id: "org-1",
          name: "テスト店舗",
          slug: "abc123def456",
          role: "owner",
        },
        onboarding: {
          staff_count: 0,
          shift_slot_count: 0,
          is_complete: false,
        },
      }),
    );

    await Home();

    expect(mockRedirect).toHaveBeenCalledWith("/schedule");
    expect(mockRedirect).not.toHaveBeenCalledWith("/onboarding");
  });

  it("onboarding.is_complete が true でも /schedule にリダイレクトする（getting-started は埋め込みカードで対応）", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1", email: "owner@example.com" },
      expires: "2099-01-01",
    });
    const org = makeOrganizationMembership();
    mockFetchMeServer.mockResolvedValueOnce(
      makeMeResponse({
        organizations: [org],
        current_organization: {
          id: "org-1",
          name: "テスト店舗",
          slug: "abc123def456",
          role: "owner",
        },
        onboarding: {
          staff_count: 5,
          shift_slot_count: 3,
          is_complete: true,
        },
      }),
    );

    await Home();

    expect(mockRedirect).toHaveBeenCalledWith("/schedule");
    expect(mockRedirect).not.toHaveBeenCalledWith("/onboarding");
  });
});
