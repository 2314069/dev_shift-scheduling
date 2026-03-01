from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.repositories import SkillRepository
from backend.schemas import SkillRequirementCreate, SkillRequirementResponse

router = APIRouter(prefix="/api/skill-requirements", tags=["skill-requirements"])


@router.get("", response_model=list[SkillRequirementResponse])
def list_skill_requirements(db: Session = Depends(get_db)):
    repo = SkillRepository(db)
    return repo.list_skill_requirements()


@router.post("", response_model=SkillRequirementResponse, status_code=201)
def create_skill_requirement(data: SkillRequirementCreate, db: Session = Depends(get_db)):
    repo = SkillRepository(db)
    return repo.create_skill_requirement(**data.model_dump())


@router.delete("/{req_id}", status_code=204)
def delete_skill_requirement(req_id: int, db: Session = Depends(get_db)):
    repo = SkillRepository(db)
    if not repo.delete_skill_requirement(req_id):
        raise HTTPException(status_code=404, detail="Skill requirement not found")
