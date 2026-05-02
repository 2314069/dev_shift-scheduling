import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInForm } from "@/components/auth/sign-in-form";

// next-auth/react の signIn をモックして実際のサーバー通信を避ける
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

import { signIn } from "next-auth/react";
const mockSignIn = vi.mocked(signIn);

describe("SignInForm", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
  });

  it("メール入力フォームが表示される", () => {
    render(<SignInForm />);

    expect(
      screen.getByRole("textbox", { name: "メールアドレス" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ログインリンクを送る" }),
    ).toBeInTheDocument();
  });

  it("送信ボタンが押せてメール送信が実行される", async () => {
    const user = userEvent.setup();
    // signIn はオーバーロードを持つため any キャストで型エラーを回避する
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSignIn.mockResolvedValueOnce(undefined as any);

    render(<SignInForm callbackUrl="/schedule" />);

    await user.type(
      screen.getByRole("textbox", { name: "メールアドレス" }),
      "test@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "ログインリンクを送る" }),
    );

    expect(mockSignIn).toHaveBeenCalledWith("nodemailer", {
      email: "test@example.com",
      redirectTo: "/schedule",
    });
  });

  it("不正なメールアドレスでバリデーションエラーが表示される", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(
      screen.getByRole("textbox", { name: "メールアドレス" }),
      "not-an-email",
    );
    await user.click(
      screen.getByRole("button", { name: "ログインリンクを送る" }),
    );

    expect(
      screen.getByText("正しいメールアドレスを入力してください"),
    ).toBeInTheDocument();
    // バリデーションエラー時は signIn が呼ばれない
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("空のメールアドレスで送信するとエラーが表示される", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.click(
      screen.getByRole("button", { name: "ログインリンクを送る" }),
    );

    expect(
      screen.getByText("メールアドレスを入力してください"),
    ).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("サーバーエラー時にエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    // 送信失敗時のエラー（NEXT_REDIRECT 以外）
    mockSignIn.mockRejectedValueOnce(new Error("Network error"));

    render(<SignInForm />);

    await user.type(
      screen.getByRole("textbox", { name: "メールアドレス" }),
      "test@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "ログインリンクを送る" }),
    );

    expect(
      await screen.findByText(
        "メールの送信に失敗しました。しばらくしてから再試行してください",
      ),
    ).toBeInTheDocument();
  });
});
