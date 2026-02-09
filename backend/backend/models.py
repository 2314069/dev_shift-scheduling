from datetime import date, time

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    max_days_per_week: Mapped[int] = mapped_column(Integer, nullable=False, default=5)

    requests: Mapped[list["StaffRequest"]] = relationship(back_populates="staff")
    assignments: Mapped[list["ScheduleAssignment"]] = relationship(
        back_populates="staff"
    )


class ShiftSlot(Base):
    __tablename__ = "shift_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    requirements: Mapped[list["StaffingRequirement"]] = relationship(
        back_populates="shift_slot"
    )


class StaffRequest(Base):
    __tablename__ = "staff_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_slot_id: Mapped[int | None] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)

    staff: Mapped["Staff"] = relationship(back_populates="requests")


class SchedulePeriod(Base):
    __tablename__ = "schedule_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")

    assignments: Mapped[list["ScheduleAssignment"]] = relationship(
        back_populates="period"
    )


class ScheduleAssignment(Base):
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

    period: Mapped["SchedulePeriod"] = relationship(back_populates="assignments")
    staff: Mapped["Staff"] = relationship(back_populates="assignments")


class StaffingRequirement(Base):
    __tablename__ = "staffing_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shift_slot_id: Mapped[int] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=False
    )
    day_type: Mapped[str] = mapped_column(String, nullable=False)
    min_count: Mapped[int] = mapped_column(Integer, nullable=False)

    shift_slot: Mapped["ShiftSlot"] = relationship(back_populates="requirements")
