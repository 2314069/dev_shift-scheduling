import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockApiFetch } from "@/test/helpers/mock-api";
import SettingsPage from "@/app/settings/page";

// next/navigation の useRouter / useSearchParams を差し替える。
// router.replace 経由でクエリが書き換わったら useSearchParams も新しい値を返すよう、
// 内部で React state を回して反応させる。
let tabParam: string | null = null;
const mockReplace = vi.fn();

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const listeners = new Set<() => void>();
  function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }
  function getSnapshot() {
    return tabParam;
  }
  function notify() {
    listeners.forEach((cb) => cb());
  }
  // mock の外から tabParam を直接書き換えた場合の通知用
  (globalThis as { __notifyTabParam?: () => void }).__notifyTabParam = notify;

  return {
    useRouter: () => ({
      replace: (url: string, options?: unknown) => {
        mockReplace(url, options);
        const match = url.match(/[?&]tab=([^&]+)/);
        tabParam = match ? decodeURIComponent(match[1]) : null;
        notify();
      },
      push: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }),
    useSearchParams: () => {
      const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
      return {
        get: (key: string) => (key === "tab" ? value : null),
        toString: () => (value ? `tab=${value}` : ""),
      };
    },
  };
});

beforeEach(() => {
  mockApiFetch.mockReset();
  // Each of the 3 sub-components fetches its own data
  // StaffTable: /api/staff
  // ShiftSlotTable: /api/shift-slots
  // StaffingRequirementsTable: /api/staffing-requirements + /api/shift-slots
  mockApiFetch.mockResolvedValue([]);
  tabParam = null;
  mockReplace.mockReset();
  (globalThis as { __notifyTabParam?: () => void }).__notifyTabParam?.();
});

describe("SettingsPage", () => {
  it("renders all three management sections in the default 基本設定 tab", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("スタッフ管理")).toBeInTheDocument();
    });
    expect(screen.getByText("シフト枠管理")).toBeInTheDocument();
    expect(screen.getByText("必要人数設定")).toBeInTheDocument();
  });

  it("displays page title", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("設定")).toBeInTheDocument();
    });
  });

  it("初期表示で「基本設定」タブがアクティブ", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("スタッフ管理")).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "基本設定" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("「スキル要件」タブクリックでスキル要件設定が表示される", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("スタッフ管理")).toBeInTheDocument();
    });

    // 「スキル要件」テキストはタブとセクション見出しの両方に出るのでタブの方を選ぶ
    await user.click(screen.getByRole("tab", { name: /スキル要件/ }));

    await waitFor(() => {
      expect(screen.getByText("スキル要件設定")).toBeInTheDocument();
    });
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("tab=skills"),
      expect.objectContaining({ scroll: false }),
    );
  });

  it("?tab=optimizer で着地すると「最適化詳細」タブがアクティブ", async () => {
    tabParam = "optimizer";
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("最適化の詳細設定")).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: /最適化詳細/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
