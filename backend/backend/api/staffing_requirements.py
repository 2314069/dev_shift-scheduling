from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.repositories import StaffingRequirementRepository
from backend.schemas import (
    StaffingRequirementCreate,
    StaffingRequirementResponse,
    StaffingRequirementUpdate,
)

router = APIRouter(prefix="/api/staffing-requirements", tags=["staffing-requirements"])


@router.get("", response_model=list[StaffingRequirementResponse])
def list_staffing_requirements(db: Session = Depends(get_db)):
    repo = StaffingRequirementRepository(db)
    return repo.list_all()


@router.post("", response_model=StaffingRequirementResponse, status_code=201)
def create_staffing_requirement(
    data: StaffingRequirementCreate, db: Session = Depends(get_db)
):
    repo = StaffingRequirementRepository(db)
    return repo.create(**data.model_dump())


@router.put("/{req_id}", response_model=StaffingRequirementResponse)
def update_staffing_requirement(
    req_id: int, data: StaffingRequirementUpdate, db: Session = Depends(get_db)
):
    repo = StaffingRequirementRepository(db)
    result = repo.update(req_id, data.min_count)
    if result is None:
        raise HTTPException(status_code=404, detail="Staffing requirement not found")
    return result
