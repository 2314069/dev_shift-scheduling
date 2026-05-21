/**
 * Collapsible の単体テスト
 *
 * テスト対象:
 *   - 初期 closed のとき content は DOM に存在しない
 *   - Trigger クリックで content が表示される
 *   - aria-expanded / data-state が正しく切り替わる
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

function Sample() {
  return (
    <Collapsible>
      <CollapsibleTrigger>開閉する</CollapsibleTrigger>
      <CollapsibleContent>中身のコンテンツ</CollapsibleContent>
    </Collapsible>
  );
}

describe("Collapsible", () => {
  it("初期は closed で content は DOM に存在しない", () => {
    render(<Sample />);
    expect(screen.queryByText("中身のコンテンツ")).not.toBeInTheDocument();
  });

  it("Trigger をクリックすると content が表示される", async () => {
    const user = userEvent.setup();
    render(<Sample />);

    await user.click(screen.getByRole("button", { name: "開閉する" }));

    expect(screen.getByText("中身のコンテンツ")).toBeInTheDocument();
  });

  it("aria-expanded が開閉に応じて切り替わる", async () => {
    const user = userEvent.setup();
    render(<Sample />);

    const trigger = screen.getByRole("button", { name: "開閉する" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
