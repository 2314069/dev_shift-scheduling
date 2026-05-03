from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import get_current_org_id
from backend.database import get_db
from backend.repositories import StaffRepository
from backend.schemas import StaffCreate, StaffResponse, StaffUpdate

router = APIRouter(prefix="/api/staff", tags=["staff"])


@router.get("", response_model=list[StaffResponse])
def list_staff(
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    repo = StaffRepository(db)
    return repo.list_all(org_id)


@router.post("", response_model=StaffResponse, status_code=201)
def create_staff(
    data: StaffCreate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    repo = StaffRepository(db)
    return repo.create(org_id, **data.model_dump())


@router.put("/{staff_id}", response_model=StaffResponse)
def update_staff(
    staff_id: int,
    data: StaffUpdate,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    repo = StaffRepository(db)
    result = repo.update(org_id, staff_id, **data.model_dump(exclude_unset=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Staff not found")
    return result


@router.delete("/{staff_id}", status_code=204)
def delete_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    repo = StaffRepository(db)
    if not repo.delete(org_id, staff_id):
        raise HTTPException(status_code=404, detail="Staff not found")
