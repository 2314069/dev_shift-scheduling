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

  it("does not render suggestions box when suggestions is absent", () => {
    const diagnostic = makeDiagnostic({ message: "提案なし" });
    render(<DiagnosticsPanel diagnostics={[diagnostic]} />);

    expect(screen.queryByText("解決の提案")).not.toBeInTheDocument();
  });

  it("does not render suggestions box when suggestions is empty array", () => {
    const diagnostic = makeDiagnostic({ message: "空の提案", suggestions: [] });
    render(<DiagnosticsPanel diagnostics={[diagnostic]} />);

    expect(screen.queryByText("解決の提案")).not.toBeInTheDocument();
  });

  it("renders suggestions in green box when suggestions are present", () => {
    const diagnostic = makeDiagnostic({
      message: "人数不足",
      suggestions: ["スタッフを追加してください", "シフト枠を減らしてください"],
    });
    render(<DiagnosticsPanel diagnostics={[diagnostic]} />);

    expect(screen.getByText("解決の提案")).toBeInTheDocument();
    expect(screen.getByText("• スタッフを追加してください")).toBeInTheDocument();
    expect(screen.getByText("• シフト枠を減らしてください")).toBeInTheDocument();

    const box = screen.getByText("解決の提案").closest("[class*='bg-green']");
    expect(box).toBeTruthy();
  });

  it("renders both details and suggestions when both are present", async () => {
    const diagnostic = makeDiagnostic({
      message: "複合制約違反",
      details: ["詳細情報A"],
      suggestions: ["提案A"],
    });
    render(<DiagnosticsPanel diagnostics={[diagnostic]} />);

    // 詳細は折りたたみで最初は非表示
    expect(screen.queryByText("詳細情報A")).not.toBeInTheDocument();

    // 提案は常に表示
    expect(screen.getByText("解決の提案")).toBeInTheDocument();
    expect(screen.getByText("• 提案A")).toBeInTheDocument();

    // 詳細を展開すると表示される
    await userEvent.click(screen.getByText("詳細を表示"));
    expect(screen.getByText("詳細情報A")).toBeInTheDocument();

    // 両方同時に表示されている
    expect(screen.getByText("• 提案A")).toBeInTheDocument();
  });
});
