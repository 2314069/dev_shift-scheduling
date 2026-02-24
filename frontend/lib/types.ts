export interface Staff {
  id: number;
  name: string;
  role: string;
  max_days_per_week: number;
  min_days_per_week: number;
}

export interface ShiftSlot {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
}

export interface StaffingRequirement {
  id: number;
  shift_slot_id: number;
  day_type: string;
  min_count: number;
}

export interface StaffRequest {
  id: number;
  staff_id: number;
  date: string;
  shift_slot_id: number | null;
  type: "preferred" | "unavailable";
}

export interface SchedulePeriod {
  id: number;
  start_date: string;
  end_date: string;
  status: "draft" | "published";
}

export interface ScheduleAssignment {
  id: number;
  period_id: number;
  staff_id: number;
  date: string;
  shift_slot_id: number | null;
  is_manual_edit: boolean;
}

export interface ScheduleResponse {
  period: SchedulePeriod;
  assignments: ScheduleAssignment[];
}

export interface DiagnosticItem {
  constraint: string;
  severity: "error" | "warning";
  message: string;
  details?: string[];
}

export interface OptimizeResponse {
  status: string;
  message: string;
  assignments: ScheduleAssignment[];
  diagnostics: DiagnosticItem[];
}

export interface SolverConfig {
  id: number;
  max_consecutive_days: number;
  time_limit: number;
  min_shift_interval_hours: number;
  enable_preferred_shift: boolean;
  enable_fairness: boolean;
  enable_weekend_fairness: boolean;
  enable_shift_interval: boolean;
  enable_role_staffing: boolean;
  enable_min_days_per_week: boolean;
  enable_soft_staffing: boolean;
  weight_preferred: number;
  weight_fairness: number;
  weight_weekend_fairness: number;
  weight_soft_staffing: number;
}
