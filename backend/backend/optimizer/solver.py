from datetime import date, timedelta
from collections import defaultdict

from pulp import LpMinimize, LpProblem, LpVariable, lpSum, value

from backend.domain import (
    RoleStaffingRequirement,
    SchedulePeriod,
    ShiftSlot,
    SolverConfig,
    Staff,
    StaffingRequirement,
    StaffRequest,
)


def _get_day_type(d: date) -> str:
    return "weekend" if d.weekday() >= 5 else "weekday"


def _default_config() -> SolverConfig:
    """全新機能を無効にしたデフォルト設定（後方互換用）"""
    return SolverConfig(
        id=0,
        enable_preferred_shift=False,
        enable_fairness=False,
        enable_weekend_fairness=False,
        enable_shift_interval=False,
        enable_role_staffing=False,
        enable_min_days_per_week=False,
        enable_soft_staffing=False,
    )


def _build_preferred_map(
    requests: list[StaffRequest],
) -> dict[tuple[int, date, int | None], bool]:
    """preferred リクエストを (staff_id, date, shift_slot_id|None) のセットに変換"""
    preferred = {}
    for req in requests:
        if req.type == "preferred":
            preferred[(req.staff_id, req.date, req.shift_slot_id)] = True
    return preferred


def _shifts_conflict(slot_a: ShiftSlot, slot_b: ShiftSlot, min_hours: int) -> bool:
    """slot_a の翌日に slot_b を入れるとインターバル違反になるか判定"""
    end_min = slot_a.end_time.hour * 60 + slot_a.end_time.minute
    start_min = slot_b.start_time.hour * 60 + slot_b.start_time.minute
    gap = (24 * 60 - end_min) + start_min
    return gap < min_hours * 60


def solve_schedule(
    period: SchedulePeriod,
    staff_list: list[Staff],
    slots: list[ShiftSlot],
    requirements: list[StaffingRequirement],
    requests: list[StaffRequest],
    max_consecutive_days: int = 6,
    time_limit: int = 30,
    config: SolverConfig | None = None,
    role_requirements: list[RoleStaffingRequirement] | None = None,
) -> dict:
    if config is None:
        config = _default_config()
        config.max_consecutive_days = max_consecutive_days
        config.time_limit = time_limit

    if role_requirements is None:
        role_requirements = []

    # 日付リスト
    num_days = (period.end_date - period.start_date).days + 1
    dates = [period.start_date + timedelta(days=i) for i in range(num_days)]

    # 不可日マップ
    unavailable = set()
    for req in requests:
        if req.type == "unavailable":
            unavailable.add((req.staff_id, req.date))

    # 必要人数マップ
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

    # === 目的関数の構築 ===
    objective_terms = []

    # ベース: 超過人数の最小化
    objective_terms.append(
        lpSum(
            x[(s.id, d, t.id)]
            for s in staff_list
            for d in dates
            for t in slots
        )
        - lpSum(
            req_map.get((t.id, _get_day_type(d)), 0)
            for d in dates
            for t in slots
        )
    )

    # A1: 希望シフト反映
    if config.enable_preferred_shift:
        preferred_map = _build_preferred_map(requests)
        preferred_bonus = []
        for s in staff_list:
            for d in dates:
                for t in slots:
                    # shift_slot_id 指定ありの preferred
                    if (s.id, d, t.id) in preferred_map:
                        preferred_bonus.append(x[(s.id, d, t.id)])
                    # shift_slot_id なしの preferred（当日のどの枠でも OK）
                    elif (s.id, d, None) in preferred_map:
                        preferred_bonus.append(x[(s.id, d, t.id)])
        if preferred_bonus:
            objective_terms.append(-config.weight_preferred * lpSum(preferred_bonus))

    # A2: 公平性（均等配分）
    if config.enable_fairness:
        z_max = LpVariable("z_max", lowBound=0)
        z_min = LpVariable("z_min", lowBound=0)
        for s in staff_list:
            total = lpSum(x[(s.id, d, t.id)] for d in dates for t in slots)
            prob += total <= z_max
            prob += total >= z_min
        objective_terms.append(config.weight_fairness * (z_max - z_min))

    # A3: 土日祝の公平配分
    if config.enable_weekend_fairness:
        weekend_dates = [d for d in dates if d.weekday() >= 5]
        if weekend_dates:
            zw_max = LpVariable("zw_max", lowBound=0)
            zw_min = LpVariable("zw_min", lowBound=0)
            for s in staff_list:
                total = lpSum(
                    x[(s.id, d, t.id)] for d in weekend_dates for t in slots
                )
                prob += total <= zw_max
                prob += total >= zw_min
            objective_terms.append(
                config.weight_weekend_fairness * (zw_max - zw_min)
            )

    # C7: 必要人数のソフト制約化（スラック変数）
    slack_vars = {}
    if config.enable_soft_staffing:
        for d in dates:
            for t in slots:
                min_count = req_map.get((t.id, _get_day_type(d)), 0)
                if min_count > 0:
                    u = LpVariable(f"u_{d}_{t.id}", lowBound=0)
                    slack_vars[(d, t.id)] = u
        if slack_vars:
            objective_terms.append(
                config.weight_soft_staffing * lpSum(slack_vars.values())
            )

    prob += lpSum(objective_terms)

    # === ハード制約 ===

    # 制約1: 1日1シフト
    for s in staff_list:
        for d in dates:
            prob += lpSum(x[(s.id, d, t.id)] for t in slots) <= 1

    # 制約2: 必要人数確保
    for d in dates:
        for t in slots:
            min_count = req_map.get((t.id, _get_day_type(d)), 0)
            if min_count > 0:
                if config.enable_soft_staffing:
                    u = slack_vars.get((d, t.id))
                    if u is not None:
                        prob += (
                            lpSum(x[(s.id, d, t.id)] for s in staff_list) + u
                            >= min_count
                        )
                else:
                    prob += (
                        lpSum(x[(s.id, d, t.id)] for s in staff_list)
                        >= min_count
                    )

    # 制約3: 不可日
    for s in staff_list:
        for d in dates:
            if (s.id, d) in unavailable:
                for t in slots:
                    prob += x[(s.id, d, t.id)] == 0

    # 制約4: 連勤制限
    for s in staff_list:
        for i in range(len(dates) - config.max_consecutive_days):
            window = dates[i : i + config.max_consecutive_days + 1]
            prob += (
                lpSum(x[(s.id, d, t.id)] for d in window for t in slots)
                <= config.max_consecutive_days
            )

    # 制約5: 週あたり勤務上限
    for s in staff_list:
        weeks: dict[date, list[date]] = defaultdict(list)
        for d in dates:
            week_start = d - timedelta(days=d.weekday())
            weeks[week_start].append(d)
        for week_dates in weeks.values():
            prob += (
                lpSum(x[(s.id, d, t.id)] for d in week_dates for t in slots)
                <= s.max_days_per_week
            )

    # B4: シフト間インターバル
    if config.enable_shift_interval:
        conflict_pairs = []
        for t_a in slots:
            for t_b in slots:
                if _shifts_conflict(t_a, t_b, config.min_shift_interval_hours):
                    conflict_pairs.append((t_a.id, t_b.id))
        if conflict_pairs:
            for s in staff_list:
                for i in range(len(dates) - 1):
                    d1 = dates[i]
                    d2 = dates[i + 1]
                    for t_a_id, t_b_id in conflict_pairs:
                        prob += x[(s.id, d1, t_a_id)] + x[(s.id, d2, t_b_id)] <= 1

    # B5: ロール別必要人数
    if config.enable_role_staffing and role_requirements:
        for rr in role_requirements:
            eligible = [s for s in staff_list if s.role == rr.role]
            for d in dates:
                if _get_day_type(d) == rr.day_type:
                    prob += (
                        lpSum(x[(s.id, d, rr.shift_slot_id)] for s in eligible)
                        >= rr.min_count
                    )

    # B6: 最低勤務日数/週
    if config.enable_min_days_per_week:
        for s in staff_list:
            if s.min_days_per_week > 0:
                weeks_min: dict[date, list[date]] = defaultdict(list)
                for d in dates:
                    week_start = d - timedelta(days=d.weekday())
                    weeks_min[week_start].append(d)
                for week_dates in weeks_min.values():
                    prob += (
                        lpSum(
                            x[(s.id, d, t.id)] for d in week_dates for t in slots
                        )
                        >= s.min_days_per_week
                    )

    # 求解
    try:
        from pulp import SCIP_CMD

        solver = SCIP_CMD(msg=0, timeLimit=config.time_limit)
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
