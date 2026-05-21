/**
 * Tabs の単体テスト
 *
 * テスト対象:
 *   - 初期 defaultValue のタブが表示される
 *   - Trigger クリックで TabsContent が切り替わる
 *   - ARIA 属性 (role="tab" / role="tabpanel" / aria-selected) が正しく付与される
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function Sample() {
  return (
    <Tabs defaultValue="a">
      <TabsList>
        <TabsTrigger value="a">タブA</TabsTrigger>
        <TabsTrigger value="b">タブB</TabsTrigger>
      </TabsList>
      <TabsContent value="a">中身A</TabsContent>
      <TabsContent value="b">中身B</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("defaultValue のタブ内容が表示される", () => {
    render(<Sample />);
    expect(screen.getByText("中身A")).toBeInTheDocument();
    expect(screen.queryByText("中身B")).not.toBeInTheDocument();
  });

  it("Trigger クリックで内容が切り替わる", async () => {
    const user = userEvent.setup();
    render(<Sample />);

    await user.click(screen.getByRole("tab", { name: "タブB" }));

    expect(screen.getByText("中身B")).toBeInTheDocument();
    expect(screen.queryByText("中身A")).not.toBeInTheDocument();
  });

  it("aria-selected が選択中のタブにのみ true になる", async () => {
    const user = userEvent.setup();
    render(<Sample />);

    const tabA = screen.getByRole("tab", { name: "タブA" });
    const tabB = screen.getByRole("tab", { name: "タブB" });

    expect(tabA).toHaveAttribute("aria-selected", "true");
    expect(tabB).toHaveAttribute("aria-selected", "false");

    await user.click(tabB);

    expect(tabA).toHaveAttribute("aria-selected", "false");
    expect(tabB).toHaveAttribute("aria-selected", "true");
  });
});
