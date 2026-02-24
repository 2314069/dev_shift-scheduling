from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from backend.domain import DiagnosticItem, ScheduleAssignment, SchedulePeriod
from backend.optimizer.solver import solve_schedule
from backend.repositories import (
    ScheduleRepository,
    StaffRepository,
    ShiftSlotRepository,
    StaffingRequirementRepository,
    StaffRequestRepository,
    SolverConfigRepository,
    RoleStaffingRequirementRepository,
)
from backend.schemas import ScheduleResponse


@dataclass
class OptimizeResult:
    status: str
    message: str
    assignments: list[ScheduleAssignment]
    diagnostics: list[DiagnosticItem] = None

    def __post_init__(self):
        if self.diagnostics is None:
            self.diagnostics = []


class ScheduleService:
    def __init__(self, db: Session):
        self._db = db
        self._schedule_repo = ScheduleRepository(db)
        self._staff_repo = StaffRepository(db)
        self._slot_repo = ShiftSlotRepository(db)
        self._requirement_repo = StaffingRequirementRepository(db)
        self._request_repo = StaffRequestRepository(db)
        self._config_repo = SolverConfigRepository(db)
        self._role_req_repo = RoleStaffingRequirementRepository(db)

    def create_period(self, start_date: date, end_date: date) -> SchedulePeriod:
        return self._schedule_repo.create_period(
            start_date=start_date, end_date=end_date
        )

    def list_periods(self) -> list[SchedulePeriod]:
        return self._schedule_repo.list_periods()

    def get_schedule(self, period_id: int) -> ScheduleResponse | None:
        period = self._schedule_repo.get_period(period_id)
        if period is None:
            return None
        assignments = self._schedule_repo.get_assignments_by_period(period_id)
        return ScheduleResponse(period=period, assignments=assignments)

    def update_assignment(
        self, period_id: int, assignment_id: int, shift_slot_id: int | None
    ) -> ScheduleAssignment | None:
        assignment = self._schedule_repo.get_assignment(assignment_id)
        if not assignment or assignment.period_id != period_id:
            return None
        return self._schedule_repo.update_assignment(assignment_id, shift_slot_id)

    def publish(self, period_id: int) -> SchedulePeriod | None:
        period = self._schedule_repo.get_period(period_id)
        if period is None:
            return None
        return self._schedule_repo.update_period_status(period_id, "published")

    def optimize(self, period_id: int) -> OptimizeResult | None:
        period = self._schedule_repo.get_period(period_id)
        if period is None:
            return None

        # 既存の自動生成結果を削除（手動編集は保持）
        self._schedule_repo.delete_auto_assignments(period_id)

        # ソルバーに必要なデータを収集
        staff_list = self._staff_repo.list_all()
        slots = self._slot_repo.list_all()
        requirements = self._requirement_repo.list_all()
        requests = self._request_repo.list_by_date_range(
            period.start_date, period.end_date
        )
        config = self._config_repo.get_or_create_default()
        role_requirements = self._role_req_repo.list_all()

        result = solve_schedule(
            period=period,
            staff_list=staff_list,
            slots=slots,
            requirements=requirements,
            requests=requests,
            config=config,
            role_requirements=role_requirements,
        )

        diagnostics = result.get("diagnostics", [])

        if result["status"] == "optimal":
            self._schedule_repo.bulk_create_assignments(
                period_id, result["assignments"]
            )
            saved = self._schedule_repo.get_assignments_by_period(period_id)
            return OptimizeResult(
                status=result["status"],
                message=result["message"],
                assignments=saved,
                diagnostics=diagnostics,
            )

        return OptimizeResult(
            status=result["status"],
            message=result["message"],
            assignments=[],
            diagnostics=diagnostics,
        )
