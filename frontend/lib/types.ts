export interface Staff {
  id: number;
  name: string;
  role: string;
  max_days_per_week: number;
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

export interface OptimizeResponse {
  status: string;
  message: string;
  assignments: ScheduleAssignment[];
}
