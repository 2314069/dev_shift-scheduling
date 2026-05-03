from sqlalchemy.orm import Session

from backend.domain import ShiftSlot
from backend.models import ShiftSlotModel


class ShiftSlotRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_domain(model: ShiftSlotModel) -> ShiftSlot:
        return ShiftSlot(
            id=model.id,
            name=model.name,
            start_time=model.start_time,
            end_time=model.end_time,
            organization_id=model.organization_id,
        )

    def list_all(self, org_id: str) -> list[ShiftSlot]:
        return [
            self._to_domain(r)
            for r in self.db.query(ShiftSlotModel)
            .filter(ShiftSlotModel.organization_id == org_id)
            .all()
        ]

    def get_by_id(self, org_id: str, slot_id: int) -> ShiftSlot | None:
        model = (
            self.db.query(ShiftSlotModel)
            .filter(ShiftSlotModel.id == slot_id, ShiftSlotModel.organization_id == org_id)
            .first()
        )
        return self._to_domain(model) if model else None

    def create(self, org_id: str, **kwargs) -> ShiftSlot:
        model = ShiftSlotModel(organization_id=org_id, **kwargs)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)

    def update(self, org_id: str, slot_id: int, **kwargs) -> ShiftSlot | None:
        model = (
            self.db.query(ShiftSlotModel)
            .filter(ShiftSlotModel.id == slot_id, ShiftSlotModel.organization_id == org_id)
            .first()
        )
        if not model:
            return None
        for key, value in kwargs.items():
            setattr(model, key, value)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)

    def delete(self, org_id: str, slot_id: int) -> bool:
        model = (
            self.db.query(ShiftSlotModel)
            .filter(ShiftSlotModel.id == slot_id, ShiftSlotModel.organization_id == org_id)
            .first()
        )
        if not model:
            return False
        self.db.delete(model)
        self.db.commit()
        return True
