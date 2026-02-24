import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockApiFetch } from "@/test/helpers/mock-api";
import {
  makeShiftSlot,
  makeStaffingRequirement,
} from "@/test/helpers/fixtures";
import { StaffingRequirementsTable } from "@/components/staffing-requirements-table";

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe("StaffingRequirementsTable", () => {
  it("displays requirements with resolved slot names", async () => {
    const slots = [
      makeShiftSlot({ id: 1, name: "早番" }),
      makeShiftSlot({ id: 2, name: "遅番" }),
    ];
    const reqs = [
      makeStaffingRequirement({ id: 1, shift_slot_id: 1, day_type: "weekday", min_count: 2 }),
      makeStaffingRequirement({ id: 2, shift_slot_id: 2, day_type: "weekend", min_count: 1 }),
    ];
    mockApiFetch.mockResolvedValueOnce(reqs); // requirements
    mockApiFetch.mockResolvedValueOnce(slots); // shift-slots

    // Note: fetchData uses Promise.all, so we need separate mocks for each call
    // Actually, let's check how the component calls them
    // It does Promise.all([apiFetch(requirements), apiFetch(shift-slots)])
    // mockResolvedValueOnce handles each call in order

    render(<StaffingRequirementsTable />);

    await waitFor(() => {
      expect(screen.getByText("早番")).toBeInTheDocument();
    });
    expect(screen.getByText("遅番")).toBeInTheDocument();
    expect(screen.getByText("平日")).toBeInTheDocument();
    expect(screen.getByText("休日")).toBeInTheDocument();
  });

  it("disables add button when no shift slots exist", async () => {
    mockApiFetch.mockResolvedValueOnce([]); // requirements
    mockApiFetch.mockResolvedValueOnce([]); // shift-slots (empty)

    render(<StaffingRequirementsTable />);

    await waitFor(() => {
      expect(screen.getByText("先にシフト枠を登録してください。")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "追加" })).toBeDisabled();
  });

  it("opens add dialog and saves", async () => {
    const user = userEvent.setup();
    const slots = [makeShiftSlot({ id: 1, name: "早番" })];
    mockApiFetch.mockResolvedValueOnce([]); // requirements
    mockApiFetch.mockResolvedValueOnce(slots); // shift-slots

    render(<StaffingRequirementsTable />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "追加" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "追加" }));
    expect(screen.getByText("必要人数追加")).toBeInTheDocument();

    // Save
    mockApiFetch.mockResolvedValueOnce({ id: 1, shift_slot_id: 1, day_type: "weekday", min_count: 1 });
    mockApiFetch.mockResolvedValueOnce([]); // re-fetch requirements
    mockApiFetch.mockResolvedValueOnce(slots); // re-fetch slots
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/staffing-requirements",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("opens edit dialog with pre-filled data", async () => {
    const user = userEvent.setup();
    const slots = [makeShiftSlot({ id: 1, name: "早番" })];
    const reqs = [
      makeStaffingRequirement({ id: 1, shift_slot_id: 1, day_type: "weekday", min_count: 3 }),
    ];
    mockApiFetch.mockResolvedValueOnce(reqs);
    mockApiFetch.mockResolvedValueOnce(slots);

    render(<StaffingRequirementsTable />);

    await waitFor(() => {
      expect(screen.getByText("早番")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "編集" }));
    expect(screen.getByText("必要人数編集")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3")).toBeInTheDocument();
  });

  it("shows empty state when no requirements exist", async () => {
    const slots = [makeShiftSlot({ id: 1, name: "早番" })];
    mockApiFetch.mockResolvedValueOnce([]);
    mockApiFetch.mockResolvedValueOnce(slots);

    render(<StaffingRequirementsTable />);

    await waitFor(() => {
      expect(screen.getByText("必要人数が設定されていません")).toBeInTheDocument();
    });
  });
});
