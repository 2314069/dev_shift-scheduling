from sqlalchemy.orm import Session

from backend.domain import RoleStaffingRequirement
from backend.models import RoleStaffingRequirementModel


class RoleStaffingRequirementRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_domain(model: RoleStaffingRequirementModel) -> RoleStaffingRequirement:
        return RoleStaffingRequirement(
            id=model.id,
            shift_slot_id=model.shift_slot_id,
            day_type=model.day_type,
            role=model.role,
            min_count=model.min_count,
        )

    def list_all(self) -> list[RoleStaffingRequirement]:
        return [
            self._to_domain(r)
            for r in self.db.query(RoleStaffingRequirementModel).all()
        ]

    def create(self, **kwargs) -> RoleStaffingRequirement:
        model = RoleStaffingRequirementModel(**kwargs)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)

    def delete(self, req_id: int) -> bool:
        model = self.db.get(RoleStaffingRequirementModel, req_id)
        if not model:
            return False
        self.db.delete(model)
        self.db.commit()
        return True
