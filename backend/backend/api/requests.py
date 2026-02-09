from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import StaffRequest, SchedulePeriod
from backend.schemas import StaffRequestBulkCreate, StaffRequestResponse

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.get("", response_model=list[StaffRequestResponse])
def list_requests(
    period_id: int = Query(...),
    staff_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    period = db.get(SchedulePeriod, period_id)
    query = db.query(StaffRequest).filter(
        StaffRequest.date >= period.start_date,
        StaffRequest.date <= period.end_date,
    )
    if staff_id is not None:
        query = query.filter(StaffRequest.staff_id == staff_id)
    return query.all()


@router.post("", response_model=list[StaffRequestResponse], status_code=201)
def bulk_create_requests(
    data: StaffRequestBulkCreate, db: Session = Depends(get_db)
):
    created = []
    for item in data.requests:
        req = StaffRequest(**item.model_dump())
        db.add(req)
        created.append(req)
    db.commit()
    for req in created:
        db.refresh(req)
    return created
