from datetime import date as date_type

from sqlalchemy.orm import Session

from backend.domain import ScheduleAssignment, SchedulePeriod
from backend.models import ScheduleAssignmentModel, SchedulePeriodModel


class ScheduleRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_period_domain(model: SchedulePeriodModel) -> SchedulePeriod:
        return SchedulePeriod(
            id=model.id,
            start_date=model.start_date,
            end_date=model.end_date,
            status=model.status,
        )

    @staticmethod
    def _to_assignment_domain(model: ScheduleAssignmentModel) -> ScheduleAssignment:
        return ScheduleAssignment(
            id=model.id,
            period_id=model.period_id,
            staff_id=model.staff_id,
            date=model.date,
            is_manual_edit=model.is_manual_edit,
            shift_slot_id=model.shift_slot_id,
        )

    # --- Period操作 ---

    def list_periods(self) -> list[SchedulePeriod]:
        models = (
            self.db.query(SchedulePeriodModel)
            .order_by(SchedulePeriodModel.start_date.desc())
            .all()
        )
        return [self._to_period_domain(m) for m in models]

    def get_period(self, period_id: int) -> SchedulePeriod | None:
        model = self.db.get(SchedulePeriodModel, period_id)
        return self._to_period_domain(model) if model else None

    def create_period(self, **kwargs) -> SchedulePeriod:
        model = SchedulePeriodModel(**kwargs)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return self._to_period_domain(model)

    def update_period_status(self, period_id: int, status: str) -> SchedulePeriod | None:
        model = self.db.get(SchedulePeriodModel, period_id)
        if not model:
            return None
        model.status = status
        self.db.commit()
        self.db.refresh(model)
        return self._to_period_domain(model)

    # --- Assignment操作 ---

    def get_assignments_by_period(self, period_id: int) -> list[ScheduleAssignment]:
        models = (
            self.db.query(ScheduleAssignmentModel)
            .filter(ScheduleAssignmentModel.period_id == period_id)
            .all()
        )
        return [self._to_assignment_domain(m) for m in models]

    def get_assignment(self, assignment_id: int) -> ScheduleAssignment | None:
        model = self.db.get(ScheduleAssignmentModel, assignment_id)
        return self._to_assignment_domain(model) if model else None

    def delete_auto_assignments(self, period_id: int) -> None:
        self.db.query(ScheduleAssignmentModel).filter(
            ScheduleAssignmentModel.period_id == period_id,
            ScheduleAssignmentModel.is_manual_edit == False,  # noqa: E712
        ).delete()
        self.db.commit()

    def bulk_create_assignments(
        self, period_id: int, assignments_data: list[dict]
    ) -> None:
        for a in assignments_data:
            model = ScheduleAssignmentModel(
                period_id=period_id,
                staff_id=a["staff_id"],
                date=date_type.fromisoformat(a["date"]),
                shift_slot_id=a["shift_slot_id"],
                is_manual_edit=False,
            )
            self.db.add(model)
        self.db.commit()

    def update_assignment(
        self, assignment_id: int, shift_slot_id: int | None
    ) -> ScheduleAssignment | None:
        model = self.db.get(ScheduleAssignmentModel, assignment_id)
        if not model:
            return None
        model.shift_slot_id = shift_slot_id
        model.is_manual_edit = True
        self.db.commit()
        self.db.refresh(model)
        return self._to_assignment_domain(model)

    def get_published_period_ending_before(self, start_date: date_type) -> SchedulePeriod | None:
        """start_date の前日を end_date とする公開済み期間を返す"""
        from datetime import timedelta
        target_end = start_date - timedelta(days=1)
        model = (
            self.db.query(SchedulePeriodModel)
            .filter(
                SchedulePeriodModel.end_date == target_end,
                SchedulePeriodModel.status == "published",
            )
            .first()
        )
        return self._to_period_domain(model) if model else None
