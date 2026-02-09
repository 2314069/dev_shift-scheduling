from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ScheduleAssignment, SchedulePeriod
from backend.optimizer.solver import solve_schedule
from backend.schemas import (
    OptimizeResponse,
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


@router.get("", response_model=list[SchedulePeriodResponse])
def list_schedule_periods(db: Session = Depends(get_db)):
    return db.query(SchedulePeriod).order_by(SchedulePeriod.start_date.desc()).all()


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


@router.post("/{period_id}/optimize", response_model=OptimizeResponse)
def optimize_schedule(period_id: int, db: Session = Depends(get_db)):
    period = db.get(SchedulePeriod, period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Schedule period not found")

    # 既存の自動生成結果を削除（手動編集は保持）
    db.query(ScheduleAssignment).filter(
        ScheduleAssignment.period_id == period_id,
        ScheduleAssignment.is_manual_edit == False,  # noqa: E712
    ).delete()
    db.commit()

    result = solve_schedule(db, period_id)

    if result["status"] == "optimal":
        for a in result["assignments"]:
            assignment = ScheduleAssignment(
                period_id=period_id,
                staff_id=a["staff_id"],
                date=date_type.fromisoformat(a["date"]),
                shift_slot_id=a["shift_slot_id"],
                is_manual_edit=False,
            )
            db.add(assignment)
        db.commit()

        # DB保存後のレスポンス用に再取得
        saved = (
            db.query(ScheduleAssignment)
            .filter(ScheduleAssignment.period_id == period_id)
            .all()
        )
        return OptimizeResponse(
            status=result["status"],
            message=result["message"],
            assignments=saved,
        )

    return OptimizeResponse(
        status=result["status"],
        message=result["message"],
        assignments=[],
    )
