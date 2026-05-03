from sqlalchemy.orm import Session

from backend.domain import StaffingRequirement
from backend.models import StaffingRequirementModel


class StaffingRequirementRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_domain(model: StaffingRequirementModel) -> StaffingRequirement:
        return StaffingRequirement(
            id=model.id,
            shift_slot_id=model.shift_slot_id,
            day_type=model.day_type,
            min_count=model.min_count,
            organization_id=model.organization_id,
        )

    def list_all(self, org_id: str) -> list[StaffingRequirement]:
        return [
            self._to_domain(r)
            for r in self.db.query(StaffingRequirementModel)
            .filter(StaffingRequirementModel.organization_id == org_id)
            .all()
        ]

    def get_by_id(self, org_id: str, req_id: int) -> StaffingRequirement | None:
        model = (
            self.db.query(StaffingRequirementModel)
            .filter(
                StaffingRequirementModel.id == req_id,
                StaffingRequirementModel.organization_id == org_id,
            )
            .first()
        )
        return self._to_domain(model) if model else None

    def create(self, org_id: str, **kwargs) -> StaffingRequirement:
        model = StaffingRequirementModel(organization_id=org_id, **kwargs)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)

    def update(self, org_id: str, req_id: int, min_count: int) -> StaffingRequirement | None:
        model = (
            self.db.query(StaffingRequirementModel)
            .filter(
                StaffingRequirementModel.id == req_id,
                StaffingRequirementModel.organization_id == org_id,
            )
            .first()
        )
        if not model:
            return None
        model.min_count = min_count
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)
