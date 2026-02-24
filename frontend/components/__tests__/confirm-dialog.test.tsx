import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/confirm-dialog";

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: "テストタイトル",
    description: "テスト説明文です",
    onConfirm: vi.fn(),
  };

  it("displays title and description when open", () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText("テストタイトル")).toBeInTheDocument();
    expect(screen.getByText("テスト説明文です")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "確認" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenChange when cancel button is clicked", async () => {
    const onOpenChange = vi.fn();
    render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("applies destructive variant class to confirm button", () => {
    render(<ConfirmDialog {...defaultProps} variant="destructive" />);

    const confirmBtn = screen.getByRole("button", { name: "確認" });
    expect(confirmBtn.className).toContain("destructive");
  });
});
