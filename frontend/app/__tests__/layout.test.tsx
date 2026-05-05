/**
 * app/layout.tsx の単体テスト（ナビゲーション 3 状態）
 *
 * テスト対象:
 *   - 未認証（session === null）→ ヘッダー非表示（ナビリンクなし）
 *   - 認証済み・店舗未所属 → ヘッダー表示、ナビリンクは非表示
 *   - 認証済み・店舗所属あり → ヘッダー表示、ナビリンク表示
 *
 * auth と fetchMeServer をモックして状態を制御する。
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-design.md §5.5
 * @see docs/plans/2026-05-05-phase1-1-onboarding-ui-design.md §4.4
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { MeResponse } from "@/lib/types";

// auth をモック
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// fetchMeServer をモック
vi.mock("@/lib/api-server", () => ({
  fetchMeServer: vi.fn(),
}));

// next/font/google をモック（テスト環境で Google Fonts を読み込まない）
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans", subsets: [] }),
  Geist_Mono: () => ({ variable: "--font-geist-mono", subsets: [] }),
}));

// SessionProvider をモック（クライアントコンポーネント）
vi.mock("@/components/auth/session-provider", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// UserNav をモック（useSession に依存するクライアントコンポーネント）
vi.mock("@/components/auth/user-nav", () => ({
  UserNav: ({ orgName }: { orgName?: string }) => (
    <div data-testid="user-nav" data-org-name={orgName ?? ""}>
      UserNav
    </div>
  ),
}));

// Toaster をモック
vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

// TooltipProvider をモック
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { auth } from "@/auth";
import { fetchMeServer } from "@/lib/api-server";

const mockAuth = vi.mocked(auth);
const mockFetchMeServer = vi.mocked(fetchMeServer);

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

describe("RootLayout ナビゲーション 3 状態", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockFetchMeServer.mockReset();
  });

  it("状態 A: 未認証の場合はヘッダーが表示されない", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const { default: RootLayout } = await import("@/app/layout");
    render(await RootLayout({ children: <div>content</div> }));

    // ヘッダー内のロゴリンクが存在しない
    expect(
      screen.queryByRole("link", { name: "シフトすけっと" }),
    ).not.toBeInTheDocument();
    // ナビリンクが存在しない
    expect(
      screen.queryByRole("link", { name: "設定" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "シフト表" }),
    ).not.toBeInTheDocument();
  });

  it("状態 B: 認証済み・店舗未所属の場合はヘッダー表示だがナビリンクは非表示", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1", email: "owner@example.com" },
      expires: "2099-01-01",
    });
    mockFetchMeServer.mockResolvedValueOnce(
      makeMeResponse({ organizations: [] }),
    );

    const { default: RootLayout } = await import("@/app/layout");
    render(await RootLayout({ children: <div>content</div> }));

    // ヘッダーロゴは表示される
    expect(
      screen.getByRole("link", { name: "シフトすけっと" }),
    ).toBeInTheDocument();

    // ナビリンクは表示されない（hasOrg === false）
    expect(
      screen.queryByRole("link", { name: "設定" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "希望入力" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "シフト確認" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "シフト表" }),
    ).not.toBeInTheDocument();
  });

  it("状態 C: 認証済み・店舗所属あり の場合はヘッダーとナビリンクを全表示", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1", email: "owner@example.com" },
      expires: "2099-01-01",
    });
    mockFetchMeServer.mockResolvedValueOnce(
      makeMeResponse({
        organizations: [
          {
            organization: {
              id: "org-1",
              name: "テスト店舗",
              slug: "abc123def456",
              created_at: "2026-05-05T10:00:00",
              updated_at: "2026-05-05T10:00:00",
              deleted_at: null,
            },
            role: "owner",
            joined_at: "2026-05-05T10:00:00",
          },
        ],
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

    const { default: RootLayout } = await import("@/app/layout");
    render(await RootLayout({ children: <div>content</div> }));

    // ヘッダーロゴが表示される
    expect(
      screen.getByRole("link", { name: "シフトすけっと" }),
    ).toBeInTheDocument();

    // ナビリンク 4 件が全表示される
    expect(screen.getByRole("link", { name: "設定" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "希望入力" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "シフト確認" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "シフト表" })).toBeInTheDocument();
  });

  it("状態 C: UserNav に店舗名（orgName）が渡される", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1", email: "owner@example.com" },
      expires: "2099-01-01",
    });
    mockFetchMeServer.mockResolvedValueOnce(
      makeMeResponse({
        organizations: [
          {
            organization: {
              id: "org-1",
              name: "渋谷カフェ 本店",
              slug: "abc123def456",
              created_at: "2026-05-05T10:00:00",
              updated_at: "2026-05-05T10:00:00",
              deleted_at: null,
            },
            role: "owner",
            joined_at: "2026-05-05T10:00:00",
          },
        ],
        current_organization: {
          id: "org-1",
          name: "渋谷カフェ 本店",
          slug: "abc123def456",
          role: "owner",
        },
        onboarding: { staff_count: 1, shift_slot_count: 1, is_complete: true },
      }),
    );

    const { default: RootLayout } = await import("@/app/layout");
    render(await RootLayout({ children: <div>content</div> }));

    const userNav = screen.getByTestId("user-nav");
    expect(userNav).toHaveAttribute("data-org-name", "渋谷カフェ 本店");
  });

  it("状態 B: UserNav に orgName が渡されない（undefined）", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1", email: "owner@example.com" },
      expires: "2099-01-01",
    });
    mockFetchMeServer.mockResolvedValueOnce(
      makeMeResponse({ organizations: [], current_organization: null }),
    );

    const { default: RootLayout } = await import("@/app/layout");
    render(await RootLayout({ children: <div>content</div> }));

    const userNav = screen.getByTestId("user-nav");
    // orgName が undefined のとき data-org-name は空文字になる（モック実装に合わせる）
    expect(userNav).toHaveAttribute("data-org-name", "");
  });

  it("fetchMeServer がエラーをスローした場合はナビリンクを非表示にする（バックエンドダウン耐性）", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1", email: "owner@example.com" },
      expires: "2099-01-01",
    });
    // catch(() => null) で吸収されるため、レイアウトはクラッシュしない
    mockFetchMeServer.mockRejectedValueOnce(new Error("API error: 500"));

    const { default: RootLayout } = await import("@/app/layout");
    render(await RootLayout({ children: <div>content</div> }));

    // hasOrg === false となりナビリンクは非表示
    expect(
      screen.queryByRole("link", { name: "設定" }),
    ).not.toBeInTheDocument();
  });
});
