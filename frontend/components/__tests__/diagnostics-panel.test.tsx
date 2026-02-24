import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiagnosticsPanel } from "@/components/diagnostics-panel";
import { makeDiagnostic } from "@/test/helpers/fixtures";

describe("DiagnosticsPanel", () => {
  it("renders null for empty diagnostics array", () => {
    const { container } = render(<DiagnosticsPanel diagnostics={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("displays error items with red styling", () => {
    const diagnostic = makeDiagnostic({
      severity: "error",
      message: "人数不足エラー",
    });
    render(<DiagnosticsPanel diagnostics={[diagnostic]} />);

    expect(screen.getByText("人数不足エラー")).toBeInTheDocument();
    const row = screen.getByText("人数不足エラー").closest("[class*='bg-red']");
    expect(row).toBeTruthy();
  });

  it("displays warning items with yellow styling", () => {
    const diagnostic = makeDiagnostic({
      severity: "warning",
      message: "希望未反映警告",
    });
    render(<DiagnosticsPanel diagnostics={[diagnostic]} />);

    expect(screen.getByText("希望未反映警告")).toBeInTheDocument();
    const row = screen
      .getByText("希望未反映警告")
      .closest("[class*='bg-yellow']");
    expect(row).toBeTruthy();
  });

  it("expands and collapses details", async () => {
    const diagnostic = makeDiagnostic({
      message: "制約違反",
      details: ["詳細情報1", "詳細情報2"],
    });
    render(<DiagnosticsPanel diagnostics={[diagnostic]} />);

    // Details should be hidden initially
    expect(screen.queryByText("詳細情報1")).not.toBeInTheDocument();

    // Click to expand
    await userEvent.click(screen.getByText("詳細を表示"));
    expect(screen.getByText("詳細情報1")).toBeInTheDocument();
    expect(screen.getByText("詳細情報2")).toBeInTheDocument();

    // Click to collapse
    await userEvent.click(screen.getByText("詳細を非表示"));
    expect(screen.queryByText("詳細情報1")).not.toBeInTheDocument();
  });

  it("renders errors before warnings", () => {
    const diagnostics = [
      makeDiagnostic({ severity: "warning", message: "警告メッセージ" }),
      makeDiagnostic({ severity: "error", message: "エラーメッセージ" }),
    ];
    render(<DiagnosticsPanel diagnostics={diagnostics} />);

    const items = screen.getAllByText(/メッセージ/);
    expect(items[0].textContent).toBe("エラーメッセージ");
    expect(items[1].textContent).toBe("警告メッセージ");
  });
});
