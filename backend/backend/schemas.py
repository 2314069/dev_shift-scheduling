from datetime import date, datetime, time

from pydantic import BaseModel

# ---- 認証・組織関連スキーマ（Phase 0-1 追加） ----
# サブタスク 2（内部認証 API）で拡張される最小限のスキーマ
# email-validator は未導入のため email フィールドは str のまま保持
# （サブタスク 2 で必要であれば pydantic[email] を追加依存する）


class UserCreate(BaseModel):
    id: str  # 呼び出し元（Auth.js）が UUID v4 を生成して送る
    email: str
    name: str | None = None
    image: str | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    email_verified_at: datetime | None
    name: str | None
    image: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}


class OrganizationCreate(BaseModel):
    id: str  # 呼び出し元（Auth.js）が UUID v4 を生成して送る
    name: str
    slug: str


class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}


class OrganizationMemberCreate(BaseModel):
    organization_id: str
    user_id: str
    role: str = "owner"


class OrganizationMemberResponse(BaseModel):
    id: int
    organization_id: str
    user_id: str
    role: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class VerificationTokenCreate(BaseModel):
    identifier: str  # email アドレス
    token: str  # hashed token
    expires: datetime


class VerificationTokenResponse(BaseModel):
    identifier: str
    token: str
    expires: datetime

    model_config = {"from_attributes": True}


# --- Staff ---
class StaffCreate(BaseModel):
    name: str
    role: str
    max_days_per_week: int = 5
    min_days_per_week: int = 0


class StaffUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    max_days_per_week: int | None = None
    min_days_per_week: int | None = None


class StaffResponse(BaseModel):
    id: int
    name: str
    role: str
    max_days_per_week: int
    min_days_per_week: int

    model_config = {"from_attributes": True}


# --- ShiftSlot ---
class ShiftSlotCreate(BaseModel):
    name: str
    start_time: time
    end_time: time


class ShiftSlotUpdate(BaseModel):
    name: str | None = None
    start_time: time | None = None
    end_time: time | None = None


class ShiftSlotResponse(BaseModel):
    id: int
    name: str
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


# --- StaffingRequirement ---
class StaffingRequirementCreate(BaseModel):
    shift_slot_id: int
    day_type: str
    min_count: int


class StaffingRequirementUpdate(BaseModel):
    min_count: int


class StaffingRequirementResponse(BaseModel):
    id: int
    shift_slot_id: int
    day_type: str
    min_count: int

    model_config = {"from_attributes": True}


# --- StaffRequest ---
class StaffRequestItem(BaseModel):
    staff_id: int
    date: date
    shift_slot_id: int | None = None
    type: str  # "preferred" or "unavailable"


class StaffRequestBulkCreate(BaseModel):
    period_id: int
    requests: list[StaffRequestItem]


class StaffRequestResponse(BaseModel):
    id: int
    staff_id: int
    date: date
    shift_slot_id: int | None
    type: str

    model_config = {"from_attributes": True}


# --- SchedulePeriod ---
class SchedulePeriodCreate(BaseModel):
    start_date: date
    end_date: date


class SchedulePeriodResponse(BaseModel):
    id: int
    start_date: date
    end_date: date
    status: str

    model_config = {"from_attributes": True}


# --- ScheduleAssignment ---
class ScheduleAssignmentResponse(BaseModel):
    id: int
    period_id: int
    staff_id: int
    date: date
    shift_slot_id: int | None
    is_manual_edit: bool

    model_config = {"from_attributes": True}


class ScheduleAssignmentUpdate(BaseModel):
    shift_slot_id: int | None = None


class ScheduleResponse(BaseModel):
    period: SchedulePeriodResponse
    assignments: list[ScheduleAssignmentResponse]


# --- Diagnostic ---
class DiagnosticItemSchema(BaseModel):
    constraint: str
    severity: str
    message: str
    details: list[str] | None = None
    suggestions: list[str] | None = None


# --- Optimize ---
class OptimizeResponse(BaseModel):
    status: str  # "optimal", "infeasible", "timeout"
    message: str
    assignments: list[ScheduleAssignmentResponse]
    diagnostics: list[DiagnosticItemSchema] = []


# --- SolverConfig ---
class SolverConfigUpdate(BaseModel):
    max_consecutive_days: int | None = None
    time_limit: int | None = None
    min_shift_interval_hours: int | None = None
    enable_preferred_shift: bool | None = None
    enable_fairness: bool | None = None
    enable_weekend_fairness: bool | None = None
    enable_shift_interval: bool | None = None
    enable_role_staffing: bool | None = None
    enable_min_days_per_week: bool | None = None
    enable_soft_staffing: bool | None = None
    enable_reverse_cycle_prohibition: bool | None = None
    enable_skill_staffing: bool | None = None
    weight_preferred: float | None = None
    weight_fairness: float | None = None
    weight_weekend_fairness: float | None = None
    weight_soft_staffing: float | None = None


class SolverConfigResponse(BaseModel):
    id: int
    max_consecutive_days: int
    time_limit: int
    min_shift_interval_hours: int
    enable_preferred_shift: bool
    enable_fairness: bool
    enable_weekend_fairness: bool
    enable_shift_interval: bool
    enable_role_staffing: bool
    enable_min_days_per_week: bool
    enable_soft_staffing: bool
    enable_reverse_cycle_prohibition: bool
    enable_skill_staffing: bool
    weight_preferred: float
    weight_fairness: float
    weight_weekend_fairness: float
    weight_soft_staffing: float

    model_config = {"from_attributes": True}


# --- RoleStaffingRequirement ---
class RoleStaffingRequirementCreate(BaseModel):
    shift_slot_id: int
    day_type: str
    role: str
    min_count: int


class RoleStaffingRequirementResponse(BaseModel):
    id: int
    shift_slot_id: int
    day_type: str
    role: str
    min_count: int

    model_config = {"from_attributes": True}


# --- StaffSkill ---
class StaffSkillCreate(BaseModel):
    skill: str


class StaffSkillResponse(BaseModel):
    id: int
    staff_id: int
    skill: str

    model_config = {"from_attributes": True}


# --- SkillRequirement ---
class SkillRequirementCreate(BaseModel):
    shift_slot_id: int
    day_type: str
    skill: str
    min_count: int


class SkillRequirementResponse(BaseModel):
    id: int
    shift_slot_id: int
    day_type: str
    skill: str
    min_count: int

    model_config = {"from_attributes": True}


# --- Fairness Dashboard ---
class StaffFairnessMetrics(BaseModel):
    staff_id: int
    staff_name: str
    total_shifts: int
    early_shifts: int
    late_shifts: int
    other_shifts: int
    weekend_shifts: int


class FairnessSummary(BaseModel):
    avg_total: float
    avg_early: float
    avg_late: float
    avg_weekend: float


class FairnessDashboardResponse(BaseModel):
    staff_metrics: list[StaffFairnessMetrics]
    summary: FairnessSummary
