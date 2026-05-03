from datetime import date, datetime, time, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


def _utcnow() -> datetime:
    """タイムゾーン情報を持たない UTC 現在時刻を返す。

    SQLite は timezone-aware な datetime を保存できないため、
    tzinfo を除去した naive datetime を使う。
    Python 3.12 以降 datetime.utcnow() は deprecated なのでこのヘルパーで統一する。
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---- 認証・組織関連モデル（Phase 0-1 追加） ----


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # UUID v4
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow, nullable=False
    )
    # Phase 1-8 で退会処理に使用する論理削除フラグ
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    members: Mapped[list["OrganizationMember"]] = relationship(back_populates="user")


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # UUID v4
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow, nullable=False
    )
    # Phase 1-8 で最終メンバー退会後 30 日猶予ソフトデリートに使用
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    members: Mapped[list["OrganizationMember"]] = relationship(
        back_populates="organization"
    )


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Phase 0-3 で RBAC に活用。現時点は owner のみ運用
    role: Mapped[str] = mapped_column(String(20), default="owner", nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, nullable=False
    )

    __table_args__ = (UniqueConstraint("user_id", "organization_id"),)

    user: Mapped["User"] = relationship(back_populates="members")
    organization: Mapped["Organization"] = relationship(back_populates="members")


class VerificationToken(Base):
    """Magic Link 用の使い捨てトークン。Auth.js Email Provider 仕様に合わせるため
    identifier（email）+ token の複合 PK とする"""

    __tablename__ = "verification_tokens"

    identifier: Mapped[str] = mapped_column(
        String(255), primary_key=True
    )  # email アドレス
    token: Mapped[str] = mapped_column(String(255), primary_key=True)  # hashed token
    expires: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class StaffModel(Base):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, default="default", index=True
    )
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
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, default="default", index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    requirements: Mapped[list["StaffingRequirementModel"]] = relationship(
        back_populates="shift_slot"
    )


class StaffRequestModel(Base):
    __tablename__ = "staff_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, default="default", index=True
    )
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
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, default="default", index=True
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")

    assignments: Mapped[list["ScheduleAssignmentModel"]] = relationship(
        back_populates="period"
    )


class ScheduleAssignmentModel(Base):
    __tablename__ = "schedule_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, default="default", index=True
    )
    period_id: Mapped[int] = mapped_column(
        ForeignKey("schedule_periods.id"), nullable=False
    )
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_slot_id: Mapped[int | None] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=True
    )
    is_manual_edit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    period: Mapped["SchedulePeriodModel"] = relationship(back_populates="assignments")
    staff: Mapped["StaffModel"] = relationship(back_populates="assignments")


class StaffingRequirementModel(Base):
    __tablename__ = "staffing_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, default="default", index=True
    )
    shift_slot_id: Mapped[int] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=False
    )
    day_type: Mapped[str] = mapped_column(String, nullable=False)
    min_count: Mapped[int] = mapped_column(Integer, nullable=False)

    shift_slot: Mapped["ShiftSlotModel"] = relationship(back_populates="requirements")


class SolverConfigModel(Base):
    __tablename__ = "solver_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, default="default", index=True
    )
    max_consecutive_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=6
    )
    time_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    min_shift_interval_hours: Mapped[int] = mapped_column(
        Integer, nullable=False, default=11
    )
    # トグル
    enable_preferred_shift: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    enable_fairness: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enable_weekend_fairness: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    enable_shift_interval: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    enable_role_staffing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    enable_min_days_per_week: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    enable_soft_staffing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    enable_reverse_cycle_prohibition: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    enable_skill_staffing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    # 重み
    weight_preferred: Mapped[float] = mapped_column(Float, nullable=False, default=3.0)
    weight_fairness: Mapped[float] = mapped_column(Float, nullable=False, default=2.0)
    weight_weekend_fairness: Mapped[float] = mapped_column(
        Float, nullable=False, default=2.0
    )
    weight_soft_staffing: Mapped[float] = mapped_column(
        Float, nullable=False, default=10.0
    )


class RoleStaffingRequirementModel(Base):
    __tablename__ = "role_staffing_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, default="default", index=True
    )
    shift_slot_id: Mapped[int] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=False
    )
    day_type: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    min_count: Mapped[int] = mapped_column(Integer, nullable=False)

    shift_slot: Mapped["ShiftSlotModel"] = relationship()


class StaffSkillModel(Base):
    __tablename__ = "staff_skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, default="default", index=True
    )
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)
    skill: Mapped[str] = mapped_column(String, nullable=False)


class SkillRequirementModel(Base):
    __tablename__ = "skill_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, default="default", index=True
    )
    shift_slot_id: Mapped[int] = mapped_column(
        ForeignKey("shift_slots.id"), nullable=False
    )
    day_type: Mapped[str] = mapped_column(String, nullable=False)
    skill: Mapped[str] = mapped_column(String, nullable=False)
    min_count: Mapped[int] = mapped_column(Integer, nullable=False)
