/**
 * GettingStartedChecklist の単体テスト
 *
 * テスト対象:
 *   - 全ステップ未完了時の表示（番号バッジ・「設定画面へ →」ボタン）
 *   - ステップ 1（スタッフ）完了: 緑チェックバッジ・「再設定する →」ボタン
 *   - ステップ 2（シフト枠）完了: 緑チェックバッジ・「再設定する →」ボタン
 *   - ステップ 3 は常に未完了表示・「任意」バッジが表示される
 *   - ステップ 4 は常に未完了表示・「シフト表へ →」ボタン
 *   - is_complete === false: 「あとで設定する」ボタンが表示される
 *   - is_complete === true: 完了メッセージと「シフト表を開く」CTA が表示される
 *   - 各ステップのリンク先（/settings、/schedule）が正しい
 *   - 「あとで設定する」リンク先が /schedule
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-ui-design.md §4.2
 * @see docs/plans/2026-05-05-phase1-1-onboarding-design.md §7.1
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GettingStartedChecklist } from "@/components/onboarding/getting-started-checklist";

describe("GettingStartedChecklist", () => {
  describe("全ステップ未完了（staffCount=0, shiftSlotCount=0）", () => {
    beforeEach(() => {
      render(
        <GettingStartedChecklist
          staffCount={0}
          shiftSlotCount={0}
          isComplete={false}
        />,
      );
    });

    it("カードタイトル「はじめましょう！」が表示される", () => {
      expect(screen.getByText("はじめましょう！")).toBeInTheDocument();
    });

    it("カードサブタイトル「4つのステップで...」が表示される", () => {
      expect(
        screen.getByText("4つのステップでシフト作成が始められます。"),
      ).toBeInTheDocument();
    });

    it("ステップ 1「スタッフを登録する」が表示される", () => {
      expect(screen.getByText("スタッフを登録する")).toBeInTheDocument();
    });

    it("ステップ 2「シフト枠を登録する」が表示される", () => {
      expect(screen.getByText("シフト枠を登録する")).toBeInTheDocument();
    });

    it("ステップ 3「必要人数を設定する」が表示される", () => {
      expect(screen.getByText("必要人数を設定する")).toBeInTheDocument();
    });

    it("ステップ 4「最初のシフトを作成する」が表示される", () => {
      expect(screen.getByText("最初のシフトを作成する")).toBeInTheDocument();
    });

    it("ステップ 3 に「任意」バッジが表示される", () => {
      expect(screen.getByText("任意")).toBeInTheDocument();
    });

    it("「あとで設定する」ボタンが表示される（is_complete=false）", () => {
      expect(
        screen.getByRole("link", { name: "あとで設定する" }),
      ).toBeInTheDocument();
    });

    it("「あとで設定する」リンクの href が /schedule である", () => {
      const link = screen.getByRole("link", { name: "あとで設定する" });
      expect(link).toHaveAttribute("href", "/schedule");
    });

    it("「シフト表を開く」CTA は表示されない（is_complete=false）", () => {
      expect(
        screen.queryByRole("link", { name: "シフト表を開く" }),
      ).not.toBeInTheDocument();
    });

    it("ステップ 1 の「設定画面へ →」リンクの href が /settings である", () => {
      const links = screen.getAllByRole("link", { name: "設定画面へ →" });
      expect(links[0]).toHaveAttribute("href", "/settings");
    });

    it("ステップ 4 の「シフト表へ →」リンクの href が /schedule である", () => {
      expect(
        screen.getByRole("link", { name: "シフト表へ →" }),
      ).toHaveAttribute("href", "/schedule");
    });
  });

  describe("ステップ 1 完了（staffCount=1, shiftSlotCount=0）", () => {
    beforeEach(() => {
      render(
        <GettingStartedChecklist
          staffCount={1}
          shiftSlotCount={0}
          isComplete={false}
        />,
      );
    });

    it("ステップ 1 の aria-label に「完了」が含まれる", () => {
      const stepItem = screen.getByRole("listitem", {
        name: /ステップ 1.*完了/,
      });
      expect(stepItem).toBeInTheDocument();
    });

    it("ステップ 1 に「再設定する →」ボタンが表示される", () => {
      expect(
        screen.getByRole("link", { name: "再設定する →" }),
      ).toBeInTheDocument();
    });

    it("ステップ 2 は未完了（「設定画面へ →」が複数表示される）", () => {
      // ステップ 2, 3 の「設定画面へ →」が未完了として表示される
      const settingsLinks = screen.getAllByRole("link", {
        name: "設定画面へ →",
      });
      expect(settingsLinks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("ステップ 2 完了（staffCount=0, shiftSlotCount=1）", () => {
    beforeEach(() => {
      render(
        <GettingStartedChecklist
          staffCount={0}
          shiftSlotCount={1}
          isComplete={false}
        />,
      );
    });

    it("ステップ 2 の aria-label に「完了」が含まれる", () => {
      const stepItem = screen.getByRole("listitem", {
        name: /ステップ 2.*完了/,
      });
      expect(stepItem).toBeInTheDocument();
    });
  });

  describe("ステップ 3 は is_complete=true でも常に未完了表示", () => {
    it("staffCount=1, shiftSlotCount=1 でもステップ 3 は aria-label「未完了」", () => {
      render(
        <GettingStartedChecklist
          staffCount={1}
          shiftSlotCount={1}
          isComplete={true}
        />,
      );
      const step3 = screen.getByRole("listitem", {
        name: /ステップ 3.*未完了/,
      });
      expect(step3).toBeInTheDocument();
    });
  });

  describe("ステップ 4 は常に未完了表示", () => {
    it("ステップ 4 の aria-label が「未完了」を含む", () => {
      render(
        <GettingStartedChecklist
          staffCount={1}
          shiftSlotCount={1}
          isComplete={true}
        />,
      );
      const step4 = screen.getByRole("listitem", {
        name: /ステップ 4.*未完了/,
      });
      expect(step4).toBeInTheDocument();
    });
  });

  describe("is_complete === true（全ステップ完了状態）", () => {
    beforeEach(() => {
      render(
        <GettingStartedChecklist
          staffCount={2}
          shiftSlotCount={3}
          isComplete={true}
        />,
      );
    });

    it("完了メッセージ「準備が整いました！...」が表示される", () => {
      expect(
        screen.getByText("準備が整いました！シフト表でシフトを作成できます。"),
      ).toBeInTheDocument();
    });

    it("「シフト表を開く」CTA ボタンが表示される", () => {
      expect(
        screen.getByRole("link", { name: "シフト表を開く" }),
      ).toBeInTheDocument();
    });

    it("「シフト表を開く」リンクの href が /schedule である", () => {
      const link = screen.getByRole("link", { name: "シフト表を開く" });
      expect(link).toHaveAttribute("href", "/schedule");
    });

    it("「あとで設定する」ボタンは表示されない（is_complete=true）", () => {
      expect(
        screen.queryByRole("link", { name: "あとで設定する" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("ログアウトリンク", () => {
    it("ログアウトリンクが表示される", () => {
      render(
        <GettingStartedChecklist
          staffCount={0}
          shiftSlotCount={0}
          isComplete={false}
        />,
      );
      expect(
        screen.getByRole("link", { name: "ログアウト" }),
      ).toBeInTheDocument();
    });

    it("ログアウトリンクの href が /api/auth/signout である", () => {
      render(
        <GettingStartedChecklist
          staffCount={0}
          shiftSlotCount={0}
          isComplete={false}
        />,
      );
      const link = screen.getByRole("link", { name: "ログアウト" });
      expect(link).toHaveAttribute("href", "/api/auth/signout");
    });
  });
});
