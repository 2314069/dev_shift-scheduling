import type {
  Staff,
  ShiftSlot,
  SchedulePeriod,
  ScheduleAssignment,
  DiagnosticItem,
  StaffingRequirement,
  SolverConfig,
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

export function makeSolverConfig(
  overrides?: Partial<SolverConfig>
): SolverConfig {
  return {
    id: 1,
    max_consecutive_days: 6,
    time_limit: 30,
    min_shift_interval_hours: 11,
    enable_preferred_shift: true,
    enable_fairness: true,
    enable_weekend_fairness: true,
    enable_shift_interval: true,
    enable_role_staffing: false,
    enable_min_days_per_week: false,
    enable_soft_staffing: false,
    weight_preferred: 3.0,
    weight_fairness: 2.0,
    weight_weekend_fairness: 2.0,
    weight_soft_staffing: 10.0,
    ...overrides,
  };
}

export function resetFixtureIds() {
  idCounter = 1;
}
