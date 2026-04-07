import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { makeFairnessDashboardData, resetFixtureIds } from "@/test/helpers/fixtures";

// fetchFairnessDashboard をモック
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  fetchFairnessDashboard: vi.fn(),
}));

import { fetchFairnessDashboard } from "@/lib/api";
const mockFetch = fetchFairnessDashboard as ReturnType<typeof vi.fn>;

import { FairnessDashboard } from "@/components/fairness-dashboard";

beforeEach(() => {
  mockFetch.mockReset();
  resetFixtureIds();
});

describe("FairnessDashboard", () => {
  it("データロード中にローディング状態を表示する", () => {
    // never resolves = ローディング継続
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<FairnessDashboard periodId={1} />);

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("データ取得後にスタッフ名と統計を表示する", async () => {
    const data = makeFairnessDashboardData();
    mockFetch.mockResolvedValueOnce(data);

    render(<FairnessDashboard periodId={1} />);

    await waitFor(() => {
      expect(screen.getByText("山田太郎")).toBeInTheDocument();
    });

    expect(screen.getByText("佐藤花子")).toBeInTheDocument();

    // テーブルヘッダーの確認
    expect(screen.getByText("スタッフ名")).toBeInTheDocument();
    expect(screen.getByText("合計")).toBeInTheDocument();
    expect(screen.getByText("早番")).toBeInTheDocument();
    expect(screen.getByText("遅番")).toBeInTheDocument();
    expect(screen.getByText("その他")).toBeInTheDocument();
    expect(screen.getByText("土日")).toBeInTheDocument();

    // サマリー行の確認
    expect(screen.getByText("全体平均")).toBeInTheDocument();
  });

  it("APIエラー時にエラーメッセージを表示する", async () => {
    mockFetch.mockRejectedValueOnce(new Error("API error: 500"));

    render(<FairnessDashboard periodId={1} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByRole("alert").textContent).toContain("API error: 500");
  });

  it("periodId に対して fetchFairnessDashboard を呼び出す", async () => {
    const data = makeFairnessDashboardData();
    mockFetch.mockResolvedValueOnce(data);

    render(<FairnessDashboard periodId={42} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(42);
    });
  });

  it("カードタイトルに「公平性分析」を表示する", async () => {
    const data = makeFairnessDashboardData();
    mockFetch.mockResolvedValueOnce(data);

    render(<FairnessDashboard periodId={1} />);

    // タイトルはローディング中も即座に表示される
    expect(screen.getByText("公平性分析")).toBeInTheDocument();
  });
});
