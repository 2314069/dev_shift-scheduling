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
            organization_id=model.organization_id,
        )

    def list_all(self, org_id: str) -> list[RoleStaffingRequirement]:
        return [
            self._to_domain(r)
            for r in self.db.query(RoleStaffingRequirementModel)
            .filter(RoleStaffingRequirementModel.organization_id == org_id)
            .all()
        ]

    def create(self, org_id: str, **kwargs) -> RoleStaffingRequirement:
        model = RoleStaffingRequirementModel(organization_id=org_id, **kwargs)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)

    def delete(self, org_id: str, req_id: int) -> bool:
        model = (
            self.db.query(RoleStaffingRequirementModel)
            .filter(
                RoleStaffingRequirementModel.id == req_id,
                RoleStaffingRequirementModel.organization_id == org_id,
            )
            .first()
        )
        if not model:
            return False
        self.db.delete(model)
        self.db.commit()
        return True
