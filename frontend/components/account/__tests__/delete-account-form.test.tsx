import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeleteAccountForm } from "../delete-account-form";

vi.mock("@/lib/api", () => ({
  deleteAccount: vi.fn(),
  ApiError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { deleteAccount } from "@/lib/api";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

describe("DeleteAccountForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初期状態では削除ボタンが disabled", () => {
    render(<DeleteAccountForm />);
    const button = screen.getByRole("button", {
      name: "アカウントを完全に削除する",
    });
    expect(button).toBeDisabled();
  });

  it("確認フレーズを正しく入力すると削除ボタンが有効になる", () => {
    render(<DeleteAccountForm />);
    const input = screen.getByLabelText(/確認のため/);
    fireEvent.change(input, { target: { value: "アカウントを削除する" } });
    const button = screen.getByRole("button", {
      name: "アカウントを完全に削除する",
    });
    expect(button).not.toBeDisabled();
  });

  it("確認フレーズが間違っていると削除ボタンは disabled のまま", () => {
    render(<DeleteAccountForm />);
    const input = screen.getByLabelText(/確認のため/);
    fireEvent.change(input, { target: { value: "違う文字列" } });
    const button = screen.getByRole("button", {
      name: "アカウントを完全に削除する",
    });
    expect(button).toBeDisabled();
  });

  it("削除実行で deleteAccount → signOut が呼ばれる", async () => {
    vi.mocked(deleteAccount).mockResolvedValueOnce(undefined);
    render(<DeleteAccountForm />);
    fireEvent.change(screen.getByLabelText(/確認のため/), {
      target: { value: "アカウントを削除する" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "アカウントを完全に削除する" }),
    );
    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/signin" });
    });
    expect(toast.success).toHaveBeenCalledWith("アカウントを削除しました");
  });

  it("API エラー時はトーストでエラー表示し signOut しない", async () => {
    vi.mocked(deleteAccount).mockRejectedValueOnce(
      new Error("Internal server error"),
    );
    render(<DeleteAccountForm />);
    fireEvent.change(screen.getByLabelText(/確認のため/), {
      target: { value: "アカウントを削除する" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "アカウントを完全に削除する" }),
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Internal server error");
    });
    expect(signOut).not.toHaveBeenCalled();
  });
});
