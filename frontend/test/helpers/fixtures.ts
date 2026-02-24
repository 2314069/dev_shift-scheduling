import type {
  Staff,
  ShiftSlot,
  SchedulePeriod,
  ScheduleAssignment,
  DiagnosticItem,
  StaffingRequirement,
} from "@/lib/types";

let idCounter = 1;

export function makeStaff(overrides?: Partial<Staff>): Staff {
  const id = idCounter++;
  return {
    id,
    name: `スタッフ${id}`,
    role: "正社員",
    max_days_per_week: 5,
    ...overrides,
  };
}

export function makeShiftSlot(overrides?: Partial<ShiftSlot>): ShiftSlot {
  const id = idCounter++;
  return {
    id,
    name: `早番`,
    start_time: "09:00",
    end_time: "17:00",
    ...overrides,
  };
}

export function makeSchedulePeriod(
  overrides?: Partial<SchedulePeriod>
): SchedulePeriod {
  const id = idCounter++;
  return {
    id,
    start_date: "2026-03-01",
    end_date: "2026-03-31",
    status: "draft",
    ...overrides,
  };
}

export function makeAssignment(
  overrides?: Partial<ScheduleAssignment>
): ScheduleAssignment {
  const id = idCounter++;
  return {
    id,
    period_id: 1,
    staff_id: 1,
    date: "2026-03-01",
    shift_slot_id: 1,
    is_manual_edit: false,
    ...overrides,
  };
}

export function makeDiagnostic(
  overrides?: Partial<DiagnosticItem>
): DiagnosticItem {
  return {
    constraint: "min_staffing",
    severity: "error",
    message: "最低人数を満たせません",
    ...overrides,
  };
}

export function makeStaffingRequirement(
  overrides?: Partial<StaffingRequirement>
): StaffingRequirement {
  const id = idCounter++;
  return {
    id,
    shift_slot_id: 1,
    day_type: "weekday",
    min_count: 2,
    ...overrides,
  };
}

export function resetFixtureIds() {
  idCounter = 1;
}
