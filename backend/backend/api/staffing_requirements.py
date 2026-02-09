from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import StaffingRequirement
from backend.schemas import (
    StaffingRequirementCreate,
    StaffingRequirementResponse,
    StaffingRequirementUpdate,
)

router = APIRouter(prefix="/api/staffing-requirements", tags=["staffing-requirements"])


@router.get("", response_model=list[StaffingRequirementResponse])
def list_staffing_requirements(db: Session = Depends(get_db)):
    return db.query(StaffingRequirement).all()


@router.post("", response_model=StaffingRequirementResponse, status_code=201)
def create_staffing_requirement(
    data: StaffingRequirementCreate, db: Session = Depends(get_db)
):
    req = StaffingRequirement(**data.model_dump())
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.put("/{req_id}", response_model=StaffingRequirementResponse)
def update_staffing_requirement(
    req_id: int, data: StaffingRequirementUpdate, db: Session = Depends(get_db)
):
    req = db.get(StaffingRequirement, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Staffing requirement not found")
    req.min_count = data.min_count
    db.commit()
    db.refresh(req)
    return req
