import pytest
from datetime import date, time
from collections import Counter, defaultdict

from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import (
    Staff,
    ShiftSlot,
    StaffRequest,
    SchedulePeriod,
    StaffingRequirement,
)
from backend.optimizer.solver import solve_schedule


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def _setup_basic_scenario(db_session):
    """3人のスタッフ、1シフト枠、3日間、各日2人必要"""
    staff = [
        Staff(name="田中", role="一般", max_days_per_week=5),
        Staff(name="佐藤", role="一般", max_days_per_week=5),
        Staff(name="鈴木", role="一般", max_days_per_week=5),
    ]
    db_session.add_all(staff)

    slot = ShiftSlot(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add(slot)
    db_session.commit()

    req = StaffingRequirement(shift_slot_id=slot.id, day_type="weekday", min_count=2)
    db_session.add(req)

    period = SchedulePeriod(
        start_date=date(2026, 3, 2),  # Monday
        end_date=date(2026, 3, 4),    # Wednesday
        status="draft",
    )
    db_session.add(period)
    db_session.commit()

    return period


def test_basic_schedule_feasible(db_session):
    period = _setup_basic_scenario(db_session)
    result = solve_schedule(db_session, period.id)
    assert result["status"] == "optimal"
    assert len(result["assignments"]) > 0

    # 各日に2人以上割り当てられていることを確認
    day_counts = Counter(a["date"] for a in result["assignments"])
    for d, count in day_counts.items():
        assert count >= 2


def test_unavailable_respected(db_session):
    period = _setup_basic_scenario(db_session)
    staff = db_session.query(Staff).filter_by(name="田中").first()

    # 田中は3/2が不可
    unavailable = StaffRequest(
        staff_id=staff.id,
        date=date(2026, 3, 2),
        shift_slot_id=None,
        type="unavailable",
    )
    db_session.add(unavailable)
    db_session.commit()

    result = solve_schedule(db_session, period.id)
    assert result["status"] == "optimal"

    # 田中が3/2に割り当てられていないことを確認
    for a in result["assignments"]:
        if a["staff_id"] == staff.id and a["date"] == "2026-03-02":
            pytest.fail("Unavailable staff was assigned")


def test_max_consecutive_days_respected(db_session):
    """7日間のスケジュールで連勤制限を確認"""
    staff = [
        Staff(name=f"スタッフ{i}", role="一般", max_days_per_week=5)
        for i in range(4)
    ]
    db_session.add_all(staff)

    slot = ShiftSlot(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add(slot)
    db_session.commit()

    req = StaffingRequirement(shift_slot_id=slot.id, day_type="weekday", min_count=2)
    db_session.add(req)

    period = SchedulePeriod(
        start_date=date(2026, 3, 2),   # Monday
        end_date=date(2026, 3, 8),     # Sunday (7 days)
        status="draft",
    )
    db_session.add(period)
    db_session.commit()

    result = solve_schedule(db_session, period.id, max_consecutive_days=5)
    assert result["status"] == "optimal"

    # 各スタッフが6連勤以上していないことを確認
    staff_dates = defaultdict(set)
    for a in result["assignments"]:
        staff_dates[a["staff_id"]].add(a["date"])

    for s_id, dates in staff_dates.items():
        sorted_dates = sorted(dates)
        consecutive = 1
        for i in range(1, len(sorted_dates)):
            d1 = date.fromisoformat(sorted_dates[i - 1])
            d2 = date.fromisoformat(sorted_dates[i])
            if (d2 - d1).days == 1:
                consecutive += 1
                assert consecutive <= 5, f"Staff {s_id} has {consecutive} consecutive days"
            else:
                consecutive = 1
