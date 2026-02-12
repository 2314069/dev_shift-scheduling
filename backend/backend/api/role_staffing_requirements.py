from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.repositories import RoleStaffingRequirementRepository
from backend.schemas import RoleStaffingRequirementCreate, RoleStaffingRequirementResponse

router = APIRouter(prefix="/api/role-staffing-requirements", tags=["role-staffing-requirements"])


@router.get("", response_model=list[RoleStaffingRequirementResponse])
def list_role_staffing_requirements(db: Session = Depends(get_db)):
    repo = RoleStaffingRequirementRepository(db)
    return repo.list_all()


@router.post("", response_model=RoleStaffingRequirementResponse, status_code=201)
def create_role_staffing_requirement(
    data: RoleStaffingRequirementCreate, db: Session = Depends(get_db)
):
    repo = RoleStaffingRequirementRepository(db)
    return repo.create(**data.model_dump())


@router.delete("/{req_id}", status_code=204)
def delete_role_staffing_requirement(req_id: int, db: Session = Depends(get_db)):
    repo = RoleStaffingRequirementRepository(db)
    if not repo.delete(req_id):
        raise HTTPException(status_code=404, detail="Role staffing requirement not found")
