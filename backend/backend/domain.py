from dataclasses import dataclass
from datetime import date, time


@dataclass
class Staff:
    id: int
    name: str
    role: str
    max_days_per_week: int = 5
    min_days_per_week: int = 0


@dataclass
class ShiftSlot:
    id: int
    name: str
    start_time: time
    end_time: time


@dataclass
class StaffRequest:
    id: int
    staff_id: int
    date: date
    type: str
    shift_slot_id: int | None = None


@dataclass
class SchedulePeriod:
    id: int
    start_date: date
    end_date: date
    status: str = "draft"


@dataclass
class ScheduleAssignment:
    id: int
    period_id: int
    staff_id: int
    date: date
    is_manual_edit: bool = False
    shift_slot_id: int | None = None


@dataclass
class StaffingRequirement:
    id: int
    shift_slot_id: int
    day_type: str
    min_count: int


@dataclass
class SolverConfig:
    id: int
    max_consecutive_days: int = 6
    time_limit: int = 30
    min_shift_interval_hours: int = 11
    # トグル
    enable_preferred_shift: bool = True
    enable_fairness: bool = True
    enable_weekend_fairness: bool = True
    enable_shift_interval: bool = True
    enable_role_staffing: bool = False
    enable_min_days_per_week: bool = False
    enable_soft_staffing: bool = False
    # 重み
    weight_preferred: float = 3.0
    weight_fairness: float = 2.0
    weight_weekend_fairness: float = 2.0
    weight_soft_staffing: float = 10.0


@dataclass
class RoleStaffingRequirement:
    id: int
    shift_slot_id: int
    day_type: str
    role: str
    min_count: int
