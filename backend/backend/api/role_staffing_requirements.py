from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import get_current_org_id
from backend.database import get_db
from backend.repositories import RoleStaffingRequirementRepository, ShiftSlotRepository
from backend.schemas import (
    RoleStaffingRequirementCreate,
    RoleStaffingRequirementResponse,
)

router = APIRouter(
    prefix="/api/role-staffing-requirements", tags=["role-staffing-requirements"]
)


@router.get("", response_model=list[RoleStaffingRequirementResponse])
def list_role_staffing_requirements(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    repo = RoleStaffingRequirementRepository(db)
    return repo.list_all(org_id)


@router.post("", response_model=RoleStaffingRequirementResponse, status_code=201)
def create_role_staffing_requirement(
    data: RoleStaffingRequirementCreate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if ShiftSlotRepository(db).get_by_id(org_id, data.shift_slot_id) is None:
        raise HTTPException(status_code=404, detail="Shift slot not found")
    repo = RoleStaffingRequirementRepository(db)
    return repo.create(org_id, **data.model_dump())


@router.delete("/{req_id}", status_code=204)
def delete_role_staffing_requirement(
    req_id: int,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    repo = RoleStaffingRequirementRepository(db)
    if not repo.delete(org_id, req_id):
        raise HTTPException(
            status_code=404, detail="Role staffing requirement not found"
        )
