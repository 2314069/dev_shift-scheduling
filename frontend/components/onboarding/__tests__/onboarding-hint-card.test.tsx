/**
 * OnboardingHintCard の単体テスト
 *
 * テスト対象:
 *   - 初期表示: タイトル・本文・スタッフバッジ・シフト枠バッジ・ガイドリンクの表示
 *   - dismiss ボタンクリック: カードが非表示になる
 *   - is_complete（staffCount>0 && shiftSlotCount>0）: コンポーネントが null を返す
 *   - staffCount > 0 のとき: スタッフバッジに「✓」が付く
 *   - shiftSlotCount > 0 のとき: シフト枠バッジに「✓」が付く
 *   - 「初期設定ガイドを見る →」リンクの href が /onboarding/getting-started
 *   - dismiss ボタンの aria-label が「このお知らせを閉じる」
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-ui-design.md §4.3
 * @see docs/plans/2026-05-05-phase1-1-onboarding-design.md §7.1
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingHintCard } from "@/components/onboarding/onboarding-hint-card";

describe("OnboardingHintCard", () => {
  describe("初期表示（staffCount=0, shiftSlotCount=0）", () => {
    beforeEach(() => {
      render(<OnboardingHintCard staffCount={0} shiftSlotCount={0} />);
    });

    it("タイトル「はじめに設定が必要です」が表示される", () => {
      expect(screen.getByText("はじめに設定が必要です")).toBeInTheDocument();
    });

    it("本文「シフト表を作成するには...」が表示される", () => {
      expect(
        screen.getByText(
          "シフト表を作成するには、スタッフとシフト枠の登録が必要です。",
        ),
      ).toBeInTheDocument();
    });

    it("「初期設定ガイドを見る →」リンクが表示される", () => {
      expect(
        screen.getByRole("link", { name: "初期設定ガイドを見る →" }),
      ).toBeInTheDocument();
    });

    it("「初期設定ガイドを見る →」リンクの href が /onboarding/getting-started である", () => {
      const link = screen.getByRole("link", { name: "初期設定ガイドを見る →" });
      expect(link).toHaveAttribute("href", "/onboarding/getting-started");
    });

    it("dismiss ボタン（×）が表示される", () => {
      expect(
        screen.getByRole("button", { name: "このお知らせを閉じる" }),
      ).toBeInTheDocument();
    });

    it("スタッフバッジが表示される", () => {
      expect(screen.getByText(/スタッフを登録する/)).toBeInTheDocument();
    });

    it("シフト枠バッジが表示される", () => {
      expect(screen.getByText(/シフト枠を登録する/)).toBeInTheDocument();
    });
  });

  describe("dismiss 動作", () => {
    it("dismiss ボタンをクリックするとカードが非表示になる", async () => {
      const user = userEvent.setup();
      render(<OnboardingHintCard staffCount={0} shiftSlotCount={0} />);

      await user.click(
        screen.getByRole("button", { name: "このお知らせを閉じる" }),
      );

      expect(
        screen.queryByText("はじめに設定が必要です"),
      ).not.toBeInTheDocument();
    });

    it("dismiss 後は「初期設定ガイドを見る →」も非表示になる", async () => {
      const user = userEvent.setup();
      render(<OnboardingHintCard staffCount={0} shiftSlotCount={0} />);

      await user.click(
        screen.getByRole("button", { name: "このお知らせを閉じる" }),
      );

      expect(
        screen.queryByRole("link", { name: "初期設定ガイドを見る →" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("is_complete === true（全ステップ完了）", () => {
    it("staffCount > 0 && shiftSlotCount > 0 のとき何もレンダリングしない", () => {
      const { container } = render(
        <OnboardingHintCard staffCount={1} shiftSlotCount={1} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("staffCount=5, shiftSlotCount=3 のとき何もレンダリングしない", () => {
      const { container } = render(
        <OnboardingHintCard staffCount={5} shiftSlotCount={3} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe("部分完了状態", () => {
    it("staffCount > 0 のとき: スタッフバッジに「✓」が含まれる", () => {
      render(<OnboardingHintCard staffCount={2} shiftSlotCount={0} />);
      expect(screen.getByText(/✓.*スタッフを登録する/)).toBeInTheDocument();
    });

    it("shiftSlotCount > 0 のとき: シフト枠バッジに「✓」が含まれる", () => {
      render(<OnboardingHintCard staffCount={0} shiftSlotCount={1} />);
      expect(screen.getByText(/✓.*シフト枠を登録する/)).toBeInTheDocument();
    });

    it("staffCount=1, shiftSlotCount=0 のとき: カードが表示される（完了でない）", () => {
      render(<OnboardingHintCard staffCount={1} shiftSlotCount={0} />);
      expect(screen.getByText("はじめに設定が必要です")).toBeInTheDocument();
    });

    it("staffCount=0, shiftSlotCount=1 のとき: カードが表示される（完了でない）", () => {
      render(<OnboardingHintCard staffCount={0} shiftSlotCount={1} />);
      expect(screen.getByText("はじめに設定が必要です")).toBeInTheDocument();
    });
  });
});
