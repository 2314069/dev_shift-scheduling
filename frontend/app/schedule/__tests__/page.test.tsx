import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockApiFetch } from "@/test/helpers/mock-api";
import {
  makeSchedulePeriod,
  makeStaff,
  makeShiftSlot,
  makeAssignment,
  makeDiagnostic,
} from "@/test/helpers/fixtures";
import SchedulePage from "@/app/schedule/page";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  mockApiFetch.mockReset();
});

function setupDefaultMocks({
  periods = [] as ReturnType<typeof makeSchedulePeriod>[],
  staff = [] as ReturnType<typeof makeStaff>[],
  slots = [] as ReturnType<typeof makeShiftSlot>[],
} = {}) {
  mockApiFetch.mockResolvedValueOnce(staff);    // /api/staff
  mockApiFetch.mockResolvedValueOnce(slots);    // /api/shift-slots
  mockApiFetch.mockResolvedValueOnce([]);       // /api/staffing-requirements
  mockApiFetch.mockResolvedValueOnce(periods);  // /api/schedules
}

const user = userEvent.setup({ pointerEventsCheck: 0 });

// Helper: creates a period via the "create" button, which auto-selects it
async function createAndSelectPeriod(period: ReturnType<typeof makeSchedulePeriod>, assignments: ReturnType<typeof makeAssignment>[] = []) {
  mockApiFetch.mockResolvedValueOnce(period);              // POST /api/schedules
  mockApiFetch.mockResolvedValueOnce([period]);             // re-fetch periods
  mockApiFetch.mockResolvedValueOnce({ period, assignments }); // fetchSchedule
  mockApiFetch.mockResolvedValueOnce([]);                  // /api/requests?period_id=X

  await user.click(screen.getByText("期間を作成"));

  await waitFor(() => {
    expect(screen.getByText("最適化実行")).toBeInTheDocument();
  });
}

describe("SchedulePage", () => {
  it("loads and displays period list", async () => {
    const periods = [
      makeSchedulePeriod({ id: 1, start_date: "2026-03-01", end_date: "2026-03-31", status: "draft" }),
    ];
    setupDefaultMocks({ periods });

    render(<SchedulePage />);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/schedules");
    });
  });

  it("creates a new period", async () => {
    setupDefaultMocks();

    render(<SchedulePage />);

    await waitFor(() => {
      expect(screen.getByText("期間を作成")).toBeInTheDocument();
    });

    const created = makeSchedulePeriod({ id: 1, start_date: "2026-03-01", end_date: "2026-03-31" });
    mockApiFetch.mockResolvedValueOnce(created);                        // POST /api/schedules
    mockApiFetch.mockResolvedValueOnce([created]);                       // re-fetch periods
    mockApiFetch.mockResolvedValueOnce({ period: created, assignments: [] }); // fetchSchedule
    mockApiFetch.mockResolvedValueOnce([]);                             // /api/requests?period_id=X

    await user.click(screen.getByText("期間を作成"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/schedules",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("runs optimization and updates assignments on success", async () => {
    const period = makeSchedulePeriod({ id: 1, status: "draft" });
    const staff = [makeStaff({ id: 1, name: "山田" })];
    const slots = [makeShiftSlot({ id: 1, name: "早番" })];

    setupDefaultMocks({ staff, slots });

    render(<SchedulePage />);

    await waitFor(() => {
      expect(screen.getByText("期間を作成")).toBeInTheDocument();
    });

    await createAndSelectPeriod(period);

    // Run optimization
    const assignment = makeAssignment({ period_id: 1, staff_id: 1, shift_slot_id: 1 });
    mockApiFetch.mockResolvedValueOnce({
      status: "optimal",
      message: "最適解が見つかりました",
      assignments: [assignment],
      diagnostics: [],
    });

    await user.click(screen.getByText("最適化実行"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/schedules/1/optimize",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("shows diagnostics after failed optimization", async () => {
    const period = makeSchedulePeriod({ id: 1, status: "draft" });
    setupDefaultMocks();

    render(<SchedulePage />);

    await waitFor(() => {
      expect(screen.getByText("期間を作成")).toBeInTheDocument();
    });

    await createAndSelectPeriod(period);

    // Optimization fails
    const diagnostics = [
      makeDiagnostic({ severity: "error", message: "人数が不足しています" }),
    ];
    mockApiFetch.mockResolvedValueOnce({
      status: "infeasible",
      message: "最適解が見つかりませんでした",
      assignments: [],
      diagnostics,
    });

    await user.click(screen.getByText("最適化実行"));

    await waitFor(() => {
      expect(screen.getByText("人数が不足しています")).toBeInTheDocument();
    });
  });

  it("publishes a schedule via confirm dialog", async () => {
    const period = makeSchedulePeriod({ id: 1, status: "draft" });
    const assignment = makeAssignment({ period_id: 1 });
    setupDefaultMocks();

    render(<SchedulePage />);

    await waitFor(() => {
      expect(screen.getByText("期間を作成")).toBeInTheDocument();
    });

    // Create period with assignments so publish button is enabled
    await createAndSelectPeriod(period, [assignment]);

    // Click publish
    await user.click(screen.getByRole("button", { name: "公開" }));
    expect(screen.getByText("シフトの公開")).toBeInTheDocument();

    // Confirm publish
    const published = { ...period, status: "published" as const };
    mockApiFetch.mockResolvedValueOnce(published);

    await user.click(screen.getByRole("button", { name: "確認" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/schedules/1/publish",
        expect.objectContaining({ method: "PUT" })
      );
    });
  });
});
