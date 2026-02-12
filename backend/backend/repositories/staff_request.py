from datetime import date

from sqlalchemy.orm import Session

from backend.domain import StaffRequest
from backend.models import StaffRequestModel


class StaffRequestRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_domain(model: StaffRequestModel) -> StaffRequest:
        return StaffRequest(
            id=model.id,
            staff_id=model.staff_id,
            date=model.date,
            type=model.type,
            shift_slot_id=model.shift_slot_id,
        )

    def list_by_date_range(
        self,
        start_date: date,
        end_date: date,
        staff_id: int | None = None,
    ) -> list[StaffRequest]:
        query = self.db.query(StaffRequestModel).filter(
            StaffRequestModel.date >= start_date,
            StaffRequestModel.date <= end_date,
        )
        if staff_id is not None:
            query = query.filter(StaffRequestModel.staff_id == staff_id)
        return [self._to_domain(r) for r in query.all()]

    def bulk_create(self, items: list[dict]) -> list[StaffRequest]:
        created = []
        for item in items:
            model = StaffRequestModel(**item)
            self.db.add(model)
            created.append(model)
        self.db.commit()
        for model in created:
            self.db.refresh(model)
        return [self._to_domain(m) for m in created]
