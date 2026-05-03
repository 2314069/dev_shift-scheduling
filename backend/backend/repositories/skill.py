from sqlalchemy.orm import Session

from backend.domain import SkillRequirement, StaffSkill
from backend.models import SkillRequirementModel, StaffModel, StaffSkillModel


class SkillRepository:
    def __init__(self, db: Session):
        self.db = db

    # --- StaffSkill ---
    def list_skills_by_staff(self, org_id: str, staff_id: int) -> list[StaffSkill]:
        return [
            StaffSkill(id=m.id, staff_id=m.staff_id, skill=m.skill, organization_id=m.organization_id)
            for m in self.db.query(StaffSkillModel)
            .filter(
                StaffSkillModel.staff_id == staff_id,
                StaffSkillModel.organization_id == org_id,
            )
            .all()
        ]

    def add_skill(self, org_id: str, staff_id: int, skill: str) -> StaffSkill | None:
        # org_id フィルタを含めてスタッフの存在確認
        staff = (
            self.db.query(StaffModel)
            .filter(StaffModel.id == staff_id, StaffModel.organization_id == org_id)
            .first()
        )
        if not staff:
            return None
        model = StaffSkillModel(organization_id=org_id, staff_id=staff_id, skill=skill)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return StaffSkill(id=model.id, staff_id=model.staff_id, skill=model.skill, organization_id=model.organization_id)

    def delete_skill(self, org_id: str, skill_id: int, staff_id: int | None = None) -> bool:
        query = self.db.query(StaffSkillModel).filter(
            StaffSkillModel.id == skill_id,
            StaffSkillModel.organization_id == org_id,
        )
        if staff_id is not None:
            query = query.filter(StaffSkillModel.staff_id == staff_id)
        model = query.first()
        if not model:
            return False
        self.db.delete(model)
        self.db.commit()
        return True

    def list_all_staff_skills(self, org_id: str) -> list[StaffSkill]:
        return [
            StaffSkill(id=m.id, staff_id=m.staff_id, skill=m.skill, organization_id=m.organization_id)
            for m in self.db.query(StaffSkillModel)
            .filter(StaffSkillModel.organization_id == org_id)
            .all()
        ]

    # --- SkillRequirement ---
    def list_skill_requirements(self, org_id: str) -> list[SkillRequirement]:
        return [
            SkillRequirement(
                id=m.id,
                shift_slot_id=m.shift_slot_id,
                day_type=m.day_type,
                skill=m.skill,
                min_count=m.min_count,
                organization_id=m.organization_id,
            )
            for m in self.db.query(SkillRequirementModel)
            .filter(SkillRequirementModel.organization_id == org_id)
            .all()
        ]

    def create_skill_requirement(self, org_id: str, **kwargs) -> SkillRequirement:
        model = SkillRequirementModel(organization_id=org_id, **kwargs)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return SkillRequirement(
            id=model.id,
            shift_slot_id=model.shift_slot_id,
            day_type=model.day_type,
            skill=model.skill,
            min_count=model.min_count,
            organization_id=model.organization_id,
        )

    def delete_skill_requirement(self, org_id: str, req_id: int) -> bool:
        model = (
            self.db.query(SkillRequirementModel)
            .filter(
                SkillRequirementModel.id == req_id,
                SkillRequirementModel.organization_id == org_id,
            )
            .first()
        )
        if not model:
            return False
        self.db.delete(model)
        self.db.commit()
        return True
