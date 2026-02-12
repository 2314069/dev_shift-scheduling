import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import (
    StaffModel,
    ShiftSlotModel,
    StaffRequestModel,
    SchedulePeriodModel,
    ScheduleAssignmentModel,
    StaffingRequirementModel,
)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_create_staff(db_session):
    staff = StaffModel(name="田中太郎", role="リーダー", max_days_per_week=5)
    db_session.add(staff)
    db_session.commit()
    assert staff.id is not None
    assert staff.name == "田中太郎"


def test_create_shift_slot(db_session):
    from datetime import time

    slot = ShiftSlotModel(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add(slot)
    db_session.commit()
    assert slot.id is not None


def test_create_staff_request(db_session):
    from datetime import date, time

    staff = StaffModel(name="田中太郎", role="一般", max_days_per_week=5)
    slot = ShiftSlotModel(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add_all([staff, slot])
    db_session.commit()

    request = StaffRequestModel(
        staff_id=staff.id,
        date=date(2026, 3, 1),
        shift_slot_id=slot.id,
        type="preferred",
    )
    db_session.add(request)
    db_session.commit()
    assert request.id is not None


def test_create_schedule_period_and_assignment(db_session):
    from datetime import date, time

    staff = StaffModel(name="田中太郎", role="一般", max_days_per_week=5)
    slot = ShiftSlotModel(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add_all([staff, slot])
    db_session.commit()

    period = SchedulePeriodModel(
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 15),
        status="draft",
    )
    db_session.add(period)
    db_session.commit()

    assignment = ScheduleAssignmentModel(
        period_id=period.id,
        staff_id=staff.id,
        date=date(2026, 3, 1),
        shift_slot_id=slot.id,
        is_manual_edit=False,
    )
    db_session.add(assignment)
    db_session.commit()
    assert assignment.id is not None


def test_create_staffing_requirement(db_session):
    from datetime import time

    slot = ShiftSlotModel(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add(slot)
    db_session.commit()

    req = StaffingRequirementModel(
        shift_slot_id=slot.id,
        day_type="weekday",
        min_count=3,
    )
    db_session.add(req)
    db_session.commit()
    assert req.id is not None
