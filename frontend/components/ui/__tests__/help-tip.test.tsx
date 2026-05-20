/**
 * HelpTip の単体テスト
 *
 * テスト対象:
 *   - aria-label が既定で「ヘルプ」、srOnlyLabel で上書き可能
 *   - hover/focus 時に Tooltip が DOM に出る
 *   - label テキストが Tooltip 内に表示される
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelpTip } from "@/components/ui/help-tip";

describe("HelpTip", () => {
  it("ボタンの aria-label が既定で「ヘルプ」になる", () => {
    render(<HelpTip label="説明文" />);
    expect(screen.getByRole("button", { name: "ヘルプ" })).toBeInTheDocument();
  });

  it("srOnlyLabel を渡すと aria-label が上書きされる", () => {
    render(<HelpTip label="説明文" srOnlyLabel="役割の説明" />);
    expect(
      screen.getByRole("button", { name: "役割の説明" }),
    ).toBeInTheDocument();
  });

  it("focus すると label が tooltip として DOM に出る", async () => {
    const user = userEvent.setup();
    render(<HelpTip label="このカラムの説明" />);

    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "このカラムの説明",
    );
  });

  it("hover すると label が tooltip として DOM に出る", async () => {
    const user = userEvent.setup();
    render(<HelpTip label="ホバー説明" />);

    await user.hover(screen.getByRole("button", { name: "ヘルプ" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("ホバー説明");
  });
});
