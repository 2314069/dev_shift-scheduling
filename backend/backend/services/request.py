from sqlalchemy.orm import Session

from backend.domain import Staff, StaffRequest
from backend.repositories import (
    ScheduleRepository,
    ShiftSlotRepository,
    StaffRepository,
    StaffRequestRepository,
)


class RequestService:
    def __init__(self, db: Session, org_id: str):
        self._org_id = org_id
        self._schedule_repo = ScheduleRepository(db)
        self._request_repo = StaffRequestRepository(db)
        self._staff_repo = StaffRepository(db)
        self._slot_repo = ShiftSlotRepository(db)

    def list_requests_for_period(
        self, period_id: int, staff_id: int | None = None
    ) -> list[StaffRequest]:
        period = self._schedule_repo.get_period(self._org_id, period_id)
        if period is None:
            raise ValueError(f"Schedule period {period_id} not found")
        return self._request_repo.list_by_date_range(
            self._org_id, period.start_date, period.end_date, staff_id=staff_id
        )

    def list_unsubmitted_staff(self, period_id: int) -> list[Staff]:
        period = self._schedule_repo.get_period(self._org_id, period_id)
        if period is None:
            raise ValueError(f"Schedule period {period_id} not found")
        all_staff = self._staff_repo.list_all(self._org_id)
        submitted_requests = self._request_repo.list_by_date_range(
            self._org_id, period.start_date, period.end_date
        )
        submitted_ids = {r.staff_id for r in submitted_requests}
        return [s for s in all_staff if s.id not in submitted_ids]

    def bulk_create_requests(
        self, period_id: int, items: list[dict]
    ) -> list[StaffRequest]:
        # M4: period_id を当該組織で取得し、各 item.date が範囲内か検証する
        period = self._schedule_repo.get_period(self._org_id, period_id)
        if period is None:
            raise ValueError(f"Schedule period {period_id} not found")

        # 一意な staff_id / shift_slot_id をまとめてテナント検証する（N+1 を避ける）
        staff_ids = {item["staff_id"] for item in items}
        slot_ids = {
            item["shift_slot_id"]
            for item in items
            if item.get("shift_slot_id") is not None
        }
        for sid in staff_ids:
            if self._staff_repo.get_by_id(self._org_id, sid) is None:
                raise ValueError(f"Staff {sid} not found")
        for slot_id in slot_ids:
            if self._slot_repo.get_by_id(self._org_id, slot_id) is None:
                raise ValueError(f"Shift slot {slot_id} not found")

        for item in items:
            d = item["date"]
            if d < period.start_date or d > period.end_date:
                raise ValueError(
                    f"Date {d} is outside period {period_id} "
                    f"({period.start_date}..{period.end_date})"
                )

        return self._request_repo.bulk_create(self._org_id, items)
