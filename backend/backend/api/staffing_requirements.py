from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import get_current_org_id
from backend.database import get_db
from backend.repositories import ShiftSlotRepository, StaffingRequirementRepository
from backend.schemas import (
    StaffingRequirementCreate,
    StaffingRequirementResponse,
    StaffingRequirementUpdate,
)

router = APIRouter(prefix="/api/staffing-requirements", tags=["staffing-requirements"])


@router.get("", response_model=list[StaffingRequirementResponse])
def list_staffing_requirements(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    repo = StaffingRequirementRepository(db)
    return repo.list_all(org_id)


@router.post("", response_model=StaffingRequirementResponse, status_code=201)
def create_staffing_requirement(
    data: StaffingRequirementCreate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    # 他組織の shift_slot_id を弾く（同一メッセージで存在情報を漏らさない）
    if ShiftSlotRepository(db).get_by_id(org_id, data.shift_slot_id) is None:
        raise HTTPException(status_code=404, detail="Shift slot not found")
    repo = StaffingRequirementRepository(db)
    return repo.create(org_id, **data.model_dump())


@router.put("/{req_id}", response_model=StaffingRequirementResponse)
def update_staffing_requirement(
    req_id: int,
    data: StaffingRequirementUpdate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    repo = StaffingRequirementRepository(db)
    result = repo.update(org_id, req_id, data.min_count)
    if result is None:
        raise HTTPException(status_code=404, detail="Staffing requirement not found")
    return result
