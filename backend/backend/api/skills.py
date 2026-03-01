from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.repositories import SkillRepository
from backend.schemas import StaffSkillCreate, StaffSkillResponse

router = APIRouter(prefix="/api/staff", tags=["skills"])


@router.get("/{staff_id}/skills", response_model=list[StaffSkillResponse])
def list_staff_skills(staff_id: int, db: Session = Depends(get_db)):
    repo = SkillRepository(db)
    return repo.list_skills_by_staff(staff_id)


@router.post("/{staff_id}/skills", response_model=StaffSkillResponse, status_code=201)
def add_staff_skill(staff_id: int, data: StaffSkillCreate, db: Session = Depends(get_db)):
    repo = SkillRepository(db)
    result = repo.add_skill(staff_id=staff_id, skill=data.skill)
    if result is None:
        raise HTTPException(status_code=404, detail="Staff not found")
    return result


@router.delete("/{staff_id}/skills/{skill_id}", status_code=204)
def delete_staff_skill(staff_id: int, skill_id: int, db: Session = Depends(get_db)):
    repo = SkillRepository(db)
    if not repo.delete_skill(skill_id, staff_id=staff_id):
        raise HTTPException(status_code=404, detail="Skill not found")
