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
  suggestions?: string[];
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
  enable_reverse_cycle_prohibition: boolean;
  enable_skill_staffing: boolean;
  weight_preferred: number;
  weight_fairness: number;
  weight_weekend_fairness: number;
  weight_soft_staffing: number;
}

export interface StaffSkill {
  id: number;
  staff_id: number;
  skill: string;
}

export interface SkillRequirement {
  id: number;
  shift_slot_id: number;
  day_type: string;
  skill: string;
  min_count: number;
}

export interface UnsubmittedStaff {
  staff_id: number;
  name: string;
  role: string;
}

export interface StaffFairnessMetrics {
  staff_id: number;
  staff_name: string;
  total_shifts: number;
  early_shifts: number;
  late_shifts: number;
  other_shifts: number;
  weekend_shifts: number;
}

export interface FairnessSummary {
  avg_total: number;
  avg_early: number;
  avg_late: number;
  avg_weekend: number;
}

export interface FairnessDashboardData {
  staff_metrics: StaffFairnessMetrics[];
  summary: FairnessSummary;
}

// ─── Phase 1-1 オンボーディング型定義 (Planner §5.9) ───────────────────────

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OrganizationMembershipResponse {
  organization: OrganizationResponse;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

export interface CurrentOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
}

export interface OnboardingStateResponse {
  staff_count: number;
  shift_slot_count: number;
  is_complete: boolean;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    email_verified_at: string | null;
    name: string | null;
    image: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  organizations: OrganizationMembershipResponse[];
  current_organization: CurrentOrganizationSummary | null;
  onboarding: OnboardingStateResponse | null;
}
