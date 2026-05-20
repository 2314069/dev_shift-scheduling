/**
 * LandingPage の単体テスト
 *
 * テスト対象:
 *   - Hero の大見出し・サブコピー・無料バッジ・CTA リンク href
 *   - Features カード 3 件のタイトル表示
 *   - How it works の 3 ステップ表示
 *   - 末尾 CTA リンク href
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingPage } from "@/components/landing/landing-page";

describe("LandingPage", () => {
  it("Hero の大見出しとサブコピーが表示される", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: /シフト作りに/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /AI がスタッフの希望と必要人数を満たすシフトを自動で組みます/,
      ),
    ).toBeInTheDocument();
  });

  it("無料訴求バッジが表示される", () => {
    render(<LandingPage />);

    expect(
      screen.getByText("無料・メールアドレスだけで開始"),
    ).toBeInTheDocument();
  });

  it("Hero の主 CTA が /signin にリンクしている", () => {
    render(<LandingPage />);

    const cta = screen.getByRole("link", { name: /^無料で始める/ });
    expect(cta).toHaveAttribute("href", "/signin");
  });

  it("Features の 3 カードがすべて表示される", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", { name: "AI による自動シフト割り当て" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "スタッフ希望をオンラインで回収",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "公平性・勤務ルールを自動チェック",
      }),
    ).toBeInTheDocument();
  });

  it("How it works の 3 ステップが表示される", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", { name: "メールアドレスで登録" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "スタッフとシフト枠を登録" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "最適化を実行 → 公開" }),
    ).toBeInTheDocument();
  });

  it("末尾の最終 CTA が /signin にリンクしている", () => {
    render(<LandingPage />);

    const cta = screen.getByRole("link", { name: /今すぐ無料で始める/ });
    expect(cta).toHaveAttribute("href", "/signin");
  });

  it("Features セクションと How it works セクションが見出しを持つ", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", { name: "シフトすけっとの特長" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "使い方は 3 ステップ" }),
    ).toBeInTheDocument();
  });
});
