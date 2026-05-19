/**
 * NextActionsCard の単体テスト
 *
 * テスト対象:
 *   - 3つの次アクションが表示される
 *   - 各アクションの href が正しい
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextActionsCard } from "@/components/onboarding/next-actions-card";

describe("NextActionsCard", () => {
  it("「次にやること」タイトルが表示される", () => {
    render(<NextActionsCard />);
    expect(screen.getByText("次にやること")).toBeInTheDocument();
  });

  it("3 つの次アクション項目が表示される", () => {
    render(<NextActionsCard />);
    expect(
      screen.getByText("スタッフに希望入力ページを共有する"),
    ).toBeInTheDocument();
    expect(screen.getByText("スケジュール期間を作成する")).toBeInTheDocument();
    expect(
      screen.getByText("最適化を実行してシフトを公開する"),
    ).toBeInTheDocument();
  });

  it("「スタッフ画面へ」リンクの href が /staff", () => {
    render(<NextActionsCard />);
    const link = screen.getByRole("link", { name: /スタッフ画面へ/ });
    expect(link).toHaveAttribute("href", "/staff");
  });

  it("「シフト表へ」リンクが2つあり、いずれも href が /schedule", () => {
    render(<NextActionsCard />);
    const links = screen.getAllByRole("link", { name: /シフト表へ/ });
    expect(links).toHaveLength(2);
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", "/schedule");
    });
  });
});
