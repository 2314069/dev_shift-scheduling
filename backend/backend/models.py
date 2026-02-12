from datetime import date, time

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class StaffModel(Base):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    max_days_per_week: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    min_days_per_week: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    requests: Mapped[list["StaffRequestModel"]] = relationship(back_populates="staff")
    assignments: Mapped[list["ScheduleAssignmentModel"]] = relationship(
        back_populates="staff"
    )


class ShiftSlotModel(Base):
    __tablename__ = "shift_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    requirements: Mapped[list["StaffingRequirementModel"]] = relationship(
        back_populates="shift_slot"
    )


class StaffRequestModel(Base):
    __tablename__ = "staff_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_slot_id: Mapped[int | None] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)

    staff: Mapped["StaffModel"] = relationship(back_populates="requests")


class SchedulePeriodModel(Base):
    __tablename__ = "schedule_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")

    assignments: Mapped[list["ScheduleAssignmentModel"]] = relationship(
        back_populates="period"
    )


class ScheduleAssignmentModel(Base):
    __tablename__ = "schedule_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period_id: Mapped[int] = mapped_column(
        ForeignKey("schedule_periods.id"), nullable=False
    )
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_slot_id: Mapped[int | None] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=True
    )
    is_manual_edit: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    period: Mapped["SchedulePeriodModel"] = relationship(back_populates="assignments")
    staff: Mapped["StaffModel"] = relationship(back_populates="assignments")


class StaffingRequirementModel(Base):
    __tablename__ = "staffing_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shift_slot_id: Mapped[int] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=False
    )
    day_type: Mapped[str] = mapped_column(String, nullable=False)
    min_count: Mapped[int] = mapped_column(Integer, nullable=False)

    shift_slot: Mapped["ShiftSlotModel"] = relationship(back_populates="requirements")


class SolverConfigModel(Base):
    __tablename__ = "solver_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    max_consecutive_days: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
    time_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    min_shift_interval_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=11)
    # トグル
    enable_preferred_shift: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enable_fairness: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enable_weekend_fairness: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enable_shift_interval: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enable_role_staffing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    enable_min_days_per_week: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    enable_soft_staffing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # 重み
    weight_preferred: Mapped[float] = mapped_column(Float, nullable=False, default=3.0)
    weight_fairness: Mapped[float] = mapped_column(Float, nullable=False, default=2.0)
    weight_weekend_fairness: Mapped[float] = mapped_column(Float, nullable=False, default=2.0)
    weight_soft_staffing: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)


class RoleStaffingRequirementModel(Base):
    __tablename__ = "role_staffing_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shift_slot_id: Mapped[int] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=False
    )
    day_type: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    min_count: Mapped[int] = mapped_column(Integer, nullable=False)

    shift_slot: Mapped["ShiftSlotModel"] = relationship()
