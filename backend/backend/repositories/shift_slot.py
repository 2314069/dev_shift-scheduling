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
        )

    def list_all(self) -> list[ShiftSlot]:
        return [self._to_domain(r) for r in self.db.query(ShiftSlotModel).all()]

    def get_by_id(self, slot_id: int) -> ShiftSlot | None:
        model = self.db.get(ShiftSlotModel, slot_id)
        return self._to_domain(model) if model else None

    def create(self, **kwargs) -> ShiftSlot:
        model = ShiftSlotModel(**kwargs)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)

    def update(self, slot_id: int, **kwargs) -> ShiftSlot | None:
        model = self.db.get(ShiftSlotModel, slot_id)
        if not model:
            return None
        for key, value in kwargs.items():
            setattr(model, key, value)
        self.db.commit()
        self.db.refresh(model)
        return self._to_domain(model)

    def delete(self, slot_id: int) -> bool:
        model = self.db.get(ShiftSlotModel, slot_id)
        if not model:
            return False
        self.db.delete(model)
        self.db.commit()
        return True
