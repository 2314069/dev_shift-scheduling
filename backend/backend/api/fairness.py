from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import (
    ScheduleAssignmentModel,
    SchedulePeriodModel,
    ShiftSlotModel,
    StaffModel,
    User,
)
from backend.schemas import (
    FairnessDashboardResponse,
    FairnessSummary,
    StaffFairnessMetrics,
)

router = APIRouter(prefix="/api/schedules", tags=["fairness"])


def _classify_shift(shift_name: str) -> str:
    """シフト名から早番/遅番/その他を判定する。"""
    if "早" in shift_name:
        return "early"
    if "遅" in shift_name or "夜" in shift_name:
        return "late"
    return "other"


@router.get("/{period_id}/fairness", response_model=FairnessDashboardResponse)
def get_fairness_dashboard(
    period_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> FairnessDashboardResponse:
    """指定期間の公平性ダッシュボードデータを返す。"""
    period = (
        db.query(SchedulePeriodModel)
        .filter(SchedulePeriodModel.id == period_id)
        .first()
    )
    if period is None:
        raise HTTPException(status_code=404, detail="Schedule period not found")

    # 出勤アサインメント（shift_slot_id が設定されているもの）を取得
    assignments = (
        db.query(ScheduleAssignmentModel)
        .options(
            joinedload(ScheduleAssignmentModel.staff),
        )
        .filter(
            ScheduleAssignmentModel.period_id == period_id,
            ScheduleAssignmentModel.shift_slot_id.isnot(None),
        )
        .all()
    )

    # shift_slot_id → ShiftSlotModel のマッピングを一括取得
    slot_ids = {a.shift_slot_id for a in assignments}
    slots: dict[int, ShiftSlotModel] = {}
    if slot_ids:
        slot_rows = (
            db.query(ShiftSlotModel).filter(ShiftSlotModel.id.in_(slot_ids)).all()
        )
        slots = {s.id: s for s in slot_rows}

    # スタッフごとの集計用辞書
    # staff_id -> {"staff": StaffModel, "total": int, "early": int, "late": int, "other": int, "weekend": int}
    metrics_map: dict[int, dict] = {}

    for assignment in assignments:
        staff: StaffModel = assignment.staff
        sid = staff.id

        if sid not in metrics_map:
            metrics_map[sid] = {
                "staff": staff,
                "total": 0,
                "early": 0,
                "late": 0,
                "other": 0,
                "weekend": 0,
            }

        metrics_map[sid]["total"] += 1

        slot = slots.get(assignment.shift_slot_id)
        if slot is not None:
            category = _classify_shift(slot.name)
            metrics_map[sid][category] += 1

        # 土日判定: weekday() >= 5 → Saturday(5) or Sunday(6)
        if assignment.date.weekday() >= 5:
            metrics_map[sid]["weekend"] += 1

    staff_metrics = [
        StaffFairnessMetrics(
            staff_id=sid,
            staff_name=entry["staff"].name,
            total_shifts=entry["total"],
            early_shifts=entry["early"],
            late_shifts=entry["late"],
            other_shifts=entry["other"],
            weekend_shifts=entry["weekend"],
        )
        for sid, entry in metrics_map.items()
    ]

    # スタッフ間の平均値を計算
    n = len(staff_metrics)
    if n > 0:
        avg_total = sum(m.total_shifts for m in staff_metrics) / n
        avg_early = sum(m.early_shifts for m in staff_metrics) / n
        avg_late = sum(m.late_shifts for m in staff_metrics) / n
        avg_weekend = sum(m.weekend_shifts for m in staff_metrics) / n
    else:
        avg_total = avg_early = avg_late = avg_weekend = 0.0

    summary = FairnessSummary(
        avg_total=avg_total,
        avg_early=avg_early,
        avg_late=avg_late,
        avg_weekend=avg_weekend,
    )

    return FairnessDashboardResponse(staff_metrics=staff_metrics, summary=summary)
