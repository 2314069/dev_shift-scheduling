from datetime import date, timedelta
from collections import defaultdict

from pulp import LpMinimize, LpProblem, LpVariable, lpSum, value
from sqlalchemy.orm import Session

from backend.models import (
    SchedulePeriod,
    ShiftSlot,
    Staff,
    StaffingRequirement,
    StaffRequest,
)


def _get_day_type(d: date) -> str:
    return "weekend" if d.weekday() >= 5 else "weekday"


def solve_schedule(
    db: Session,
    period_id: int,
    max_consecutive_days: int = 6,
    time_limit: int = 30,
) -> dict:
    period = db.get(SchedulePeriod, period_id)
    staff_list = db.query(Staff).all()
    slots = db.query(ShiftSlot).all()
    requirements = db.query(StaffingRequirement).all()
    requests = (
        db.query(StaffRequest)
        .filter(
            StaffRequest.date >= period.start_date,
            StaffRequest.date <= period.end_date,
        )
        .all()
    )

    # 日付リスト
    num_days = (period.end_date - period.start_date).days + 1
    dates = [period.start_date + timedelta(days=i) for i in range(num_days)]

    # 不可日マップ: (staff_id, date) -> True
    unavailable = set()
    for req in requests:
        if req.type == "unavailable":
            unavailable.add((req.staff_id, req.date))

    # 必要人数マップ: (slot_id, day_type) -> min_count
    req_map = {}
    for r in requirements:
        req_map[(r.shift_slot_id, r.day_type)] = r.min_count

    # --- PuLP モデル構築 ---
    prob = LpProblem("ShiftScheduling", LpMinimize)

    # 決定変数
    x = {}
    for s in staff_list:
        for d in dates:
            for t in slots:
                x[(s.id, d, t.id)] = LpVariable(
                    f"x_{s.id}_{d}_{t.id}", cat="Binary"
                )

    # 目的関数: 超過人数の最小化
    prob += lpSum(
        x[(s.id, d, t.id)]
        for s in staff_list
        for d in dates
        for t in slots
    ) - lpSum(
        req_map.get((t.id, _get_day_type(d)), 0)
        for d in dates
        for t in slots
    )

    # 制約1: 1日1シフト
    for s in staff_list:
        for d in dates:
            prob += lpSum(x[(s.id, d, t.id)] for t in slots) <= 1

    # 制約2: 必要人数確保
    for d in dates:
        for t in slots:
            min_count = req_map.get((t.id, _get_day_type(d)), 0)
            if min_count > 0:
                prob += (
                    lpSum(x[(s.id, d, t.id)] for s in staff_list) >= min_count
                )

    # 制約3: 不可日
    for s in staff_list:
        for d in dates:
            if (s.id, d) in unavailable:
                for t in slots:
                    prob += x[(s.id, d, t.id)] == 0

    # 制約4: 連勤制限
    for s in staff_list:
        for i in range(len(dates) - max_consecutive_days):
            window = dates[i : i + max_consecutive_days + 1]
            prob += (
                lpSum(x[(s.id, d, t.id)] for d in window for t in slots)
                <= max_consecutive_days
            )

    # 制約5: 週あたり勤務上限
    for s in staff_list:
        # 各週（月曜始まり）でグループ化
        weeks = defaultdict(list)
        for d in dates:
            week_start = d - timedelta(days=d.weekday())
            weeks[week_start].append(d)
        for week_start, week_dates in weeks.items():
            prob += (
                lpSum(x[(s.id, d, t.id)] for d in week_dates for t in slots)
                <= s.max_days_per_week
            )

    # 求解 - try SCIP first, fall back to default (CBC)
    try:
        from pulp import SCIP_CMD
        solver = SCIP_CMD(msg=0, timeLimit=time_limit)
        prob.solve(solver)
    except Exception:
        prob.solve()

    if prob.status != 1:
        return {
            "status": "infeasible",
            "message": "実行可能なシフトが見つかりませんでした。制約を緩和してください。",
            "assignments": [],
        }

    # 結果の抽出
    assignments = []
    for s in staff_list:
        for d in dates:
            for t in slots:
                if value(x[(s.id, d, t.id)]) > 0.5:
                    assignments.append(
                        {
                            "staff_id": s.id,
                            "date": d.isoformat(),
                            "shift_slot_id": t.id,
                        }
                    )

    return {
        "status": "optimal",
        "message": "最適なシフトが見つかりました。",
        "assignments": assignments,
    }
