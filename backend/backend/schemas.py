from datetime import date, time

from pydantic import BaseModel


# --- Staff ---
class StaffCreate(BaseModel):
    name: str
    role: str
    max_days_per_week: int = 5


class StaffUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    max_days_per_week: int | None = None


class StaffResponse(BaseModel):
    id: int
    name: str
    role: str
    max_days_per_week: int

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


# --- Optimize ---
class OptimizeResponse(BaseModel):
    status: str  # "optimal", "infeasible"
    message: str
    assignments: list[ScheduleAssignmentResponse]
