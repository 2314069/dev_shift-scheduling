from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.auth import get_current_org_id
from backend.database import get_db
from backend.schemas import StaffRequestBulkCreate, StaffRequestResponse
from backend.services import RequestService

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.get("", response_model=list[StaffRequestResponse])
def list_requests(
    period_id: int = Query(...),
    staff_id: int | None = Query(None),
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    service = RequestService(db, org_id)
    try:
        return service.list_requests_for_period(period_id, staff_id=staff_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("", response_model=list[StaffRequestResponse], status_code=201)
def bulk_create_requests(
    data: StaffRequestBulkCreate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    service = RequestService(db, org_id)
    items = [item.model_dump() for item in data.requests]
    return service.bulk_create_requests(items)
