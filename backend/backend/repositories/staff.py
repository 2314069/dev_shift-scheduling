from sqlalchemy.orm import Session

from backend.domain import Staff
from backend.models import StaffModel


class StaffRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_domain(model: StaffModel) -> Staff:
        return Staff(
            id=model.id,
            name=model.name,
            role=model.role,
            max_days_per_week=model.max_days_per_week,
            min_days_per_week=model.min_days_per_week,
            organization_id=model.organization_id,
        )

    def list_all(self, org_id: str) -> list[Staff]:
        return [
            self._to_domain(r)
            for r in self.db.query(StaffModel)
            .filter(StaffModel.organization_id == org_id)
            .all()
        ]

    def get_by_id(self, org_id: str, staff_id: int) -> Staff | None:
        model = (
            self.db.query(StaffModel)
            .filter(StaffModel.id == staff_id, StaffModel.organization_id == org_id)
            .first()
        )
        return self._to_domain(model) if model else None

    def create(self, org_id: str, **kwargs) -> Staff:
        model = StaffModel(organization_id=org_id, **kwargs)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)

    def update(self, org_id: str, staff_id: int, **kwargs) -> Staff | None:
        model = (
            self.db.query(StaffModel)
            .filter(StaffModel.id == staff_id, StaffModel.organization_id == org_id)
            .first()
        )
        if not model:
            return None
        for key, value in kwargs.items():
            setattr(model, key, value)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)

    def delete(self, org_id: str, staff_id: int) -> bool:
        model = (
            self.db.query(StaffModel)
            .filter(StaffModel.id == staff_id, StaffModel.organization_id == org_id)
            .first()
        )
        if not model:
            return False
        self.db.delete(model)
        self.db.commit()
        return True
