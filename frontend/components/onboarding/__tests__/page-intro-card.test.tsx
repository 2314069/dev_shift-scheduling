/**
 * PageIntroCard の単体テスト
 *
 * テスト対象:
 *   - タイトル、ステップ一覧の表示
 *   - 「詳しい使い方を見る →」リンク href の指定（learnMoreHref）
 *   - dismiss クリックで非表示、localStorage に "1" が書かれる
 *   - localStorage に既存値があれば最初から非表示
 *   - dismiss ボタンの aria-label が「このお知らせを閉じる」
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageIntroCard } from "@/components/onboarding/page-intro-card";

const baseProps = {
  storageKey: "intro:test",
  title: "テストガイド",
  steps: ["ステップ1の説明", "ステップ2の説明", "ステップ3の説明"],
};

describe("PageIntroCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("タイトルとすべてのステップが表示される", () => {
    render(<PageIntroCard {...baseProps} />);

    expect(screen.getByText("テストガイド")).toBeInTheDocument();
    expect(screen.getByText("ステップ1の説明")).toBeInTheDocument();
    expect(screen.getByText("ステップ2の説明")).toBeInTheDocument();
    expect(screen.getByText("ステップ3の説明")).toBeInTheDocument();
  });

  it("learnMoreHref を渡すと「詳しい使い方を見る →」リンクが表示される", () => {
    render(
      <PageIntroCard
        {...baseProps}
        learnMoreHref="/onboarding/getting-started"
      />,
    );

    const link = screen.getByRole("link", { name: "詳しい使い方を見る →" });
    expect(link).toHaveAttribute("href", "/onboarding/getting-started");
  });

  it("learnMoreHref を渡さないと「詳しい使い方を見る →」リンクは表示されない", () => {
    render(<PageIntroCard {...baseProps} />);

    expect(
      screen.queryByRole("link", { name: "詳しい使い方を見る →" }),
    ).not.toBeInTheDocument();
  });

  it("dismiss ボタンをクリックするとカードが非表示になる", async () => {
    const user = userEvent.setup();
    render(<PageIntroCard {...baseProps} />);

    await user.click(
      screen.getByRole("button", { name: "このお知らせを閉じる" }),
    );

    expect(screen.queryByText("テストガイド")).not.toBeInTheDocument();
  });

  it("dismiss すると localStorage に「1」が書かれる", async () => {
    const user = userEvent.setup();
    render(<PageIntroCard {...baseProps} />);

    await user.click(
      screen.getByRole("button", { name: "このお知らせを閉じる" }),
    );

    expect(window.localStorage.getItem("intro:test")).toBe("1");
  });

  it("localStorage に既存の dismiss 記録があれば最初から非表示", () => {
    window.localStorage.setItem("intro:test", "1");
    render(<PageIntroCard {...baseProps} />);

    expect(screen.queryByText("テストガイド")).not.toBeInTheDocument();
  });

  it("dismiss ボタンの aria-label が「このお知らせを閉じる」", () => {
    render(<PageIntroCard {...baseProps} />);

    expect(
      screen.getByRole("button", { name: "このお知らせを閉じる" }),
    ).toBeInTheDocument();
  });
});
