import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShiftCalendar } from "@/components/shift-calendar";
import { makeStaff, makeShiftSlot, makeAssignment } from "@/test/helpers/fixtures";
import { mockApiFetch } from "@/test/helpers/mock-api";
import type { Staff, ShiftSlot, ScheduleAssignment } from "@/lib/types";

const staff: Staff[] = [
  makeStaff({ id: 1, name: "山田" }),
  makeStaff({ id: 2, name: "佐藤" }),
];

const slots: ShiftSlot[] = [
  makeShiftSlot({ id: 10, name: "早番", start_time: "09:00", end_time: "17:00" }),
  makeShiftSlot({ id: 20, name: "遅番", start_time: "13:00", end_time: "21:00" }),
];

function makeAssignments(): ScheduleAssignment[] {
  return [
    makeAssignment({ id: 100, period_id: 1, staff_id: 1, date: "2026-03-01", shift_slot_id: 10 }),
    makeAssignment({ id: 101, period_id: 1, staff_id: 1, date: "2026-03-02", shift_slot_id: null }),
    makeAssignment({ id: 102, period_id: 1, staff_id: 2, date: "2026-03-01", shift_slot_id: 20 }),
    makeAssignment({ id: 103, period_id: 1, staff_id: 2, date: "2026-03-02", shift_slot_id: 10 }),
  ];
}

const defaultProps = {
  periodId: 1,
  startDate: "2026-03-01",
  endDate: "2026-03-02",
  staffList: staff,
  shiftSlots: slots,
  isPublished: false,
  onAssignmentUpdated: () => {},
};

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe("ShiftCalendar paint mode", () => {
  it("shows paint toolbar when not published", () => {
    render(
      <ShiftCalendar {...defaultProps} assignments={makeAssignments()} />
    );
    const toolbar = screen.getByTestId("paint-toolbar");
    expect(toolbar).toBeInTheDocument();
    // Check toolbar buttons exist by their key shortcut labels
    expect(screen.getByRole("button", { name: /0.*休み/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1.*早番/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2.*遅番/ })).toBeInTheDocument();
  });

  it("hides paint toolbar when published", () => {
    render(
      <ShiftCalendar
        {...defaultProps}
        assignments={makeAssignments()}
        isPublished={true}
      />
    );
    expect(screen.queryByTestId("paint-toolbar")).not.toBeInTheDocument();
  });

  it("activates paint mode when clicking a toolbar button", async () => {
    const user = userEvent.setup();
    render(
      <ShiftCalendar {...defaultProps} assignments={makeAssignments()} />
    );

    // Click 早番 button to enter paint mode
    const earlyButton = screen.getByRole("button", { name: /1.*早番/ });
    await user.click(earlyButton);

    // Esc hint should appear
    expect(screen.getByText("(Escで解除)")).toBeInTheDocument();
  });

  it("deactivates paint mode when clicking same button again", async () => {
    const user = userEvent.setup();
    render(
      <ShiftCalendar {...defaultProps} assignments={makeAssignments()} />
    );

    const earlyButton = screen.getByRole("button", { name: /1.*早番/ });
    await user.click(earlyButton);
    expect(screen.getByText("(Escで解除)")).toBeInTheDocument();

    await user.click(earlyButton);
    expect(screen.queryByText("(Escで解除)")).not.toBeInTheDocument();
  });

  it("applies shift on cell click in paint mode", async () => {
    const onUpdated = vi.fn();
    render(
      <ShiftCalendar
        {...defaultProps}
        assignments={makeAssignments()}
        onAssignmentUpdated={onUpdated}
      />
    );

    // Enter paint mode with "休み"
    const offButton = screen.getByRole("button", { name: /0.*休み/ });
    fireEvent.click(offButton);

    // The cell for staff 1, date 2026-03-01 currently has "早番"
    // In paint mode, cells have cursor-crosshair and respond to mousedown
    const paintCells = document.querySelectorAll(".cursor-crosshair");
    expect(paintCells.length).toBeGreaterThan(0);

    // Mousedown on the first paint cell
    fireEvent.mouseDown(paintCells[0]);

    // Save bar should appear (pending edit created)
    expect(screen.getByText("1件の変更")).toBeInTheDocument();
  });

  it("deactivates paint mode on Escape key", async () => {
    const user = userEvent.setup();
    render(
      <ShiftCalendar {...defaultProps} assignments={makeAssignments()} />
    );

    // Enter paint mode
    const earlyButton = screen.getByRole("button", { name: /1.*早番/ });
    await user.click(earlyButton);
    expect(screen.getByText("(Escで解除)")).toBeInTheDocument();

    // Press Escape
    await user.keyboard("{Escape}");
    expect(screen.queryByText("(Escで解除)")).not.toBeInTheDocument();
  });
});
