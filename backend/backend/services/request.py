from sqlalchemy.orm import Session

from backend.domain import StaffRequest
from backend.repositories import ScheduleRepository, StaffRequestRepository


class RequestService:
    def __init__(self, db: Session):
        self._schedule_repo = ScheduleRepository(db)
        self._request_repo = StaffRequestRepository(db)

    def list_requests_for_period(
        self, period_id: int, staff_id: int | None = None
    ) -> list[StaffRequest]:
        period = self._schedule_repo.get_period(period_id)
        if period is None:
            raise ValueError(f"Schedule period {period_id} not found")
        return self._request_repo.list_by_date_range(
            period.start_date, period.end_date, staff_id=staff_id
        )

    def bulk_create_requests(self, items: list[dict]) -> list[StaffRequest]:
        return self._request_repo.bulk_create(items)
