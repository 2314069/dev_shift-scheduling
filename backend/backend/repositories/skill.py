from sqlalchemy.orm import Session

from backend.domain import SkillRequirement, StaffSkill
from backend.models import SkillRequirementModel, StaffSkillModel, StaffModel


class SkillRepository:
    def __init__(self, db: Session):
        self.db = db

    # --- StaffSkill ---
    def list_skills_by_staff(self, staff_id: int) -> list[StaffSkill]:
        return [
            StaffSkill(id=m.id, staff_id=m.staff_id, skill=m.skill)
            for m in self.db.query(StaffSkillModel)
            .filter(StaffSkillModel.staff_id == staff_id)
            .all()
        ]

    def add_skill(self, staff_id: int, skill: str) -> StaffSkill | None:
        if not self.db.get(StaffModel, staff_id):
            return None
        model = StaffSkillModel(staff_id=staff_id, skill=skill)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return StaffSkill(id=model.id, staff_id=model.staff_id, skill=model.skill)

    def delete_skill(self, skill_id: int, staff_id: int | None = None) -> bool:
        model = self.db.get(StaffSkillModel, skill_id)
        if not model:
            return False
        if staff_id is not None and model.staff_id != staff_id:
            return False  # 所有権の検証
        self.db.delete(model)
        self.db.commit()
        return True

    def list_all_staff_skills(self) -> list[StaffSkill]:
        return [
            StaffSkill(id=m.id, staff_id=m.staff_id, skill=m.skill)
            for m in self.db.query(StaffSkillModel).all()
        ]

    # --- SkillRequirement ---
    def list_skill_requirements(self) -> list[SkillRequirement]:
        return [
            SkillRequirement(
                id=m.id,
                shift_slot_id=m.shift_slot_id,
                day_type=m.day_type,
                skill=m.skill,
                min_count=m.min_count,
            )
            for m in self.db.query(SkillRequirementModel).all()
        ]

    def create_skill_requirement(self, **kwargs) -> SkillRequirement:
        model = SkillRequirementModel(**kwargs)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return SkillRequirement(
            id=model.id,
            shift_slot_id=model.shift_slot_id,
            day_type=model.day_type,
            skill=model.skill,
            min_count=model.min_count,
        )

    def delete_skill_requirement(self, req_id: int) -> bool:
        model = self.db.get(SkillRequirementModel, req_id)
        if not model:
            return False
        self.db.delete(model)
        self.db.commit()
        return True
