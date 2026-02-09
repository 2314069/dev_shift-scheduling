from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ScheduleAssignment, SchedulePeriod
from backend.schemas import (
    ScheduleAssignmentResponse,
    ScheduleAssignmentUpdate,
    SchedulePeriodCreate,
    SchedulePeriodResponse,
    ScheduleResponse,
)

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


@router.post("", response_model=SchedulePeriodResponse, status_code=201)
def create_schedule_period(
    data: SchedulePeriodCreate, db: Session = Depends(get_db)
):
    period = SchedulePeriod(**data.model_dump())
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


@router.get("/{period_id}", response_model=ScheduleResponse)
def get_schedule(period_id: int, db: Session = Depends(get_db)):
    period = db.get(SchedulePeriod, period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Schedule period not found")
    assignments = (
        db.query(ScheduleAssignment)
        .filter(ScheduleAssignment.period_id == period_id)
        .all()
    )
    return ScheduleResponse(period=period, assignments=assignments)


@router.put(
    "/{period_id}/assignments/{assignment_id}",
    response_model=ScheduleAssignmentResponse,
)
def update_assignment(
    period_id: int,
    assignment_id: int,
    data: ScheduleAssignmentUpdate,
    db: Session = Depends(get_db),
):
    assignment = db.get(ScheduleAssignment, assignment_id)
    if not assignment or assignment.period_id != period_id:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assignment.shift_slot_id = data.shift_slot_id
    assignment.is_manual_edit = True
    db.commit()
    db.refresh(assignment)
    return assignment


@router.put("/{period_id}/publish", response_model=SchedulePeriodResponse)
def publish_schedule(period_id: int, db: Session = Depends(get_db)):
    period = db.get(SchedulePeriod, period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Schedule period not found")
    period.status = "published"
    db.commit()
    db.refresh(period)
    return period
