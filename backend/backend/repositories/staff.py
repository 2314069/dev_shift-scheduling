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
        )

    def list_all(self) -> list[Staff]:
        return [self._to_domain(r) for r in self.db.query(StaffModel).all()]

    def get_by_id(self, staff_id: int) -> Staff | None:
        model = self.db.get(StaffModel, staff_id)
        return self._to_domain(model) if model else None

    def create(self, **kwargs) -> Staff:
        model = StaffModel(**kwargs)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)

    def update(self, staff_id: int, **kwargs) -> Staff | None:
        model = self.db.get(StaffModel, staff_id)
        if not model:
            return None
        for key, value in kwargs.items():
            setattr(model, key, value)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)

    def delete(self, staff_id: int) -> bool:
        model = self.db.get(StaffModel, staff_id)
        if not model:
            return False
        self.db.delete(model)
        self.db.commit()
        return True
