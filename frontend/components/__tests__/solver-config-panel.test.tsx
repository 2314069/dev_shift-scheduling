import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockApiFetch } from "@/test/helpers/mock-api";
import { makeSolverConfig, resetFixtureIds } from "@/test/helpers/fixtures";
import { SolverConfigPanel } from "@/components/solver-config-panel";

beforeEach(() => {
  mockApiFetch.mockReset();
  resetFixtureIds();
});

describe("SolverConfigPanel", () => {
  it("shows loading state then displays config", async () => {
    const config = makeSolverConfig();
    mockApiFetch.mockResolvedValueOnce(config);

    render(<SolverConfigPanel />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("希望シフト反映")).toBeInTheDocument();
    });
    expect(screen.getByText("勤務日数の公平配分")).toBeInTheDocument();
    expect(screen.getByText("土日祝の公平配分")).toBeInTheDocument();
    expect(screen.getByText("連続シフト間の休憩を保証する")).toBeInTheDocument();
  });

  it("calls PUT when toggling a feature", async () => {
    const user = userEvent.setup();
    const config = makeSolverConfig({ enable_preferred_shift: true });
    mockApiFetch.mockResolvedValueOnce(config);

    render(<SolverConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("希望シフト反映")).toBeInTheDocument();
    });

    // Toggle off preferred shift
    const toggle = screen.getByRole("switch", { name: "希望シフト反映" });
    mockApiFetch.mockResolvedValueOnce(
      makeSolverConfig({ enable_preferred_shift: false })
    );
    await user.click(toggle);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/solver-config", {
        method: "PUT",
        body: JSON.stringify({ enable_preferred_shift: false }),
      });
    });
  });

  it("shows reset confirmation and calls POST on confirm", async () => {
    const user = userEvent.setup();
    const config = makeSolverConfig();
    mockApiFetch.mockResolvedValueOnce(config);

    render(<SolverConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("デフォルトにリセット")).toBeInTheDocument();
    });

    await user.click(screen.getByText("デフォルトにリセット"));

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(
        screen.getByText("すべての最適化設定をデフォルト値に戻します。この操作は元に戻せません。")
      ).toBeInTheDocument();
    });

    mockApiFetch.mockResolvedValueOnce(makeSolverConfig());
    await user.click(screen.getByRole("button", { name: "確認" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/solver-config/reset", {
        method: "POST",
      });
    });
  });

  it("hides slider when feature is disabled", async () => {
    const config = makeSolverConfig({ enable_preferred_shift: false });
    mockApiFetch.mockResolvedValueOnce(config);

    render(<SolverConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("希望シフト反映")).toBeInTheDocument();
    });

    // Weight slider for preferred shift should not be visible
    expect(
      screen.queryByRole("slider", { name: "希望シフト反映の重み" })
    ).not.toBeInTheDocument();
  });

  it("shows slider when feature is enabled", async () => {
    const config = makeSolverConfig({ enable_preferred_shift: true });
    mockApiFetch.mockResolvedValueOnce(config);

    render(<SolverConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("希望シフト反映")).toBeInTheDocument();
    });

    // Weight value should be displayed
    expect(screen.getByText("3.0")).toBeInTheDocument();
    // Slider element should be present (via aria-label)
    expect(screen.getByLabelText("希望シフト反映の重み")).toBeInTheDocument();
  });

  it("shows preset section with 5 preset buttons", async () => {
    const config = makeSolverConfig();
    mockApiFetch.mockResolvedValueOnce(config);

    render(<SolverConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("業種別プリセット")).toBeInTheDocument();
    });

    expect(screen.getByText("バランス型")).toBeInTheDocument();
    expect(screen.getByText("飲食・サービス業")).toBeInTheDocument();
    expect(screen.getByText("介護・医療")).toBeInTheDocument();
    expect(screen.getByText("小売・店舗")).toBeInTheDocument();
    expect(screen.getByText("柔軟型")).toBeInTheDocument();
  });

  it("highlights active preset when config matches", async () => {
    // makeSolverConfig() defaults match "バランス型"
    const config = makeSolverConfig();
    mockApiFetch.mockResolvedValueOnce(config);

    render(<SolverConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("バランス型")).toBeInTheDocument();
    });

    // "カスタム設定" message should NOT appear when a preset matches
    expect(
      screen.queryByText("現在の設定はカスタム設定です。")
    ).not.toBeInTheDocument();
  });

  it("shows custom message when config does not match any preset", async () => {
    // Unique value that no preset has
    const config = makeSolverConfig({ weight_preferred: 9.9 });
    mockApiFetch.mockResolvedValueOnce(config);

    render(<SolverConfigPanel />);

    await waitFor(() => {
      expect(
        screen.getByText("現在の設定はカスタム設定です。")
      ).toBeInTheDocument();
    });
  });

  it("applies preset and calls PUT with preset values", async () => {
    const user = userEvent.setup();
    const config = makeSolverConfig();
    mockApiFetch.mockResolvedValueOnce(config);

    render(<SolverConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("飲食・サービス業")).toBeInTheDocument();
    });

    mockApiFetch.mockResolvedValueOnce(
      makeSolverConfig({
        max_consecutive_days: 5,
        enable_reverse_cycle_prohibition: true,
        weight_fairness: 3.0,
        weight_weekend_fairness: 3.0,
        weight_preferred: 2.0,
      })
    );
    await user.click(screen.getByText("飲食・サービス業"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/solver-config",
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  it("shows error state and retry button on fetch failure", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<SolverConfigPanel />);

    await waitFor(() => {
      expect(
        screen.getByText("設定の読み込みに失敗しました")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("再読み込み")).toBeInTheDocument();

    // Click retry
    mockApiFetch.mockResolvedValueOnce(makeSolverConfig());
    await userEvent.click(screen.getByText("再読み込み"));

    await waitFor(() => {
      expect(screen.getByText("希望シフト反映")).toBeInTheDocument();
    });
  });
});
