from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import (
    OptimizeResponse,
    ScheduleAssignmentResponse,
    ScheduleAssignmentUpdate,
    SchedulePeriodCreate,
    SchedulePeriodResponse,
    ScheduleResponse,
)
from backend.services import ScheduleService

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


@router.post("", response_model=SchedulePeriodResponse, status_code=201)
def create_schedule_period(
    data: SchedulePeriodCreate, db: Session = Depends(get_db)
):
    service = ScheduleService(db)
    return service.create_period(data.start_date, data.end_date)


@router.get("", response_model=list[SchedulePeriodResponse])
def list_schedule_periods(db: Session = Depends(get_db)):
    service = ScheduleService(db)
    return service.list_periods()


@router.get("/{period_id}", response_model=ScheduleResponse)
def get_schedule(period_id: int, db: Session = Depends(get_db)):
    service = ScheduleService(db)
    result = service.get_schedule(period_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Schedule period not found")
    return result


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
    service = ScheduleService(db)
    result = service.update_assignment(period_id, assignment_id, data.shift_slot_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return result


@router.put("/{period_id}/publish", response_model=SchedulePeriodResponse)
def publish_schedule(period_id: int, db: Session = Depends(get_db)):
    service = ScheduleService(db)
    result = service.publish(period_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Schedule period not found")
    return result


@router.post("/{period_id}/optimize", response_model=OptimizeResponse)
def optimize_schedule(period_id: int, db: Session = Depends(get_db)):
    service = ScheduleService(db)
    result = service.optimize(period_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Schedule period not found")
    return OptimizeResponse(
        status=result.status,
        message=result.message,
        assignments=result.assignments,
    )
