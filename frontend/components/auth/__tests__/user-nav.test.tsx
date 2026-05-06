import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserNav } from "@/components/auth/user-nav";

// next-auth/react をモックしてセッション状態を制御する
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

import { useSession, signOut } from "next-auth/react";
const mockUseSession = vi.mocked(useSession);
const mockSignOut = vi.mocked(signOut);

describe("UserNav", () => {
  beforeEach(() => {
    mockUseSession.mockReset();
    mockSignOut.mockReset();
  });

  it("未ログイン時にログインボタンが表示される", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });

    render(<UserNav />);

    expect(screen.getByRole("link", { name: "ログイン" })).toBeInTheDocument();
  });

  it("ローディング中はプレースホルダーが表示される", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "loading",
      update: vi.fn(),
    });

    const { container } = render(<UserNav />);

    // ログインボタンもアバターも表示されない（div プレースホルダー）
    expect(
      screen.queryByRole("link", { name: "ログイン" }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".rounded-full.bg-muted"),
    ).toBeInTheDocument();
  });

  it("ログイン時にアバターとメールアドレスが表示される", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          email: "owner@example.com",
          name: "店長太郎",
        },
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: vi.fn(),
    });

    render(<UserNav />);

    // アバタートリガーをクリックしてドロップダウンを開く
    await user.click(
      screen.getByRole("button", { name: "ユーザーメニューを開く" }),
    );

    expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
  });

  it("orgName が渡された場合にドロップダウンに店舗名が表示される", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          email: "owner@example.com",
          name: null,
        },
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: vi.fn(),
    });

    render(<UserNav orgName="渋谷カフェ 本店" />);

    await user.click(
      screen.getByRole("button", { name: "ユーザーメニューを開く" }),
    );

    expect(await screen.findByText("渋谷カフェ 本店")).toBeInTheDocument();
  });

  it("orgName が undefined の場合は店舗名が表示されない", async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          email: "owner@example.com",
          name: null,
        },
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: vi.fn(),
    });

    render(<UserNav />);

    await user.click(
      screen.getByRole("button", { name: "ユーザーメニューを開く" }),
    );

    // メールアドレスは表示される
    expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
    // 店舗名は表示されない
    expect(screen.queryByText("渋谷カフェ 本店")).not.toBeInTheDocument();
  });

  it("ログアウトボタンクリックで signOut が呼ばれる", async () => {
    const user = userEvent.setup();
    // signOut はオーバーロードを持つため any キャストで型エラーを回避する
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSignOut.mockResolvedValueOnce(undefined as any);
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          email: "owner@example.com",
          name: null,
        },
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: vi.fn(),
    });

    render(<UserNav />);

    await user.click(
      screen.getByRole("button", { name: "ユーザーメニューを開く" }),
    );
    await user.click(await screen.findByText("ログアウト"));

    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: "/signin" });
  });
});
