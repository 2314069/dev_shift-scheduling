from copy import deepcopy
from datetime import date, timedelta
from collections import defaultdict

from pulp import LpMinimize, LpProblem, LpVariable, lpSum, value

from backend.domain import (
    DiagnosticItem,
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


def _presolve_checks(
    dates: list[date],
    staff_list: list[Staff],
    slots: list[ShiftSlot],
    requirements: list[StaffingRequirement],
    requests: list[StaffRequest],
    config: SolverConfig,
    role_requirements: list[RoleStaffingRequirement],
) -> list[DiagnosticItem]:
    """ソルバーを使わずに算術チェックで明らかな問題を検出"""
    diagnostics: list[DiagnosticItem] = []

    unavailable = set()
    for req in requests:
        if req.type == "unavailable":
            unavailable.add((req.staff_id, req.date))

    req_map: dict[tuple[int, str], int] = {}
    for r in requirements:
        req_map[(r.shift_slot_id, r.day_type)] = r.min_count

    # 日別・シフト枠別の利用可能人数 vs 必要人数
    for d in dates:
        day_type = _get_day_type(d)
        for t in slots:
            min_count = req_map.get((t.id, day_type), 0)
            if min_count <= 0:
                continue
            unavailable_on_date = sum(
                1 for s in staff_list if (s.id, d) in unavailable
            )
            available = len(staff_list) - unavailable_on_date
            if available < min_count:
                if unavailable_on_date > 0:
                    diagnostics.append(DiagnosticItem(
                        constraint="C3_unavailable",
                        severity="error",
                        message=f"{d.isoformat()} のシフト「{t.name}」で不可日により利用可能人数({available}人)が必要人数({min_count}人)に不足しています。不可日の登録を見直してください。",
                    ))
                else:
                    diagnostics.append(DiagnosticItem(
                        constraint="C2_staffing",
                        severity="error",
                        message=f"{d.isoformat()} のシフト「{t.name}」で利用可能人数({available}人)が必要人数({min_count}人)に不足しています。",
                    ))

    # 週別の勤務上限合計 vs 必要人日
    weeks: dict[date, list[date]] = defaultdict(list)
    for d in dates:
        week_start = d - timedelta(days=d.weekday())
        weeks[week_start].append(d)
    for week_start, week_dates in weeks.items():
        total_capacity = sum(s.max_days_per_week for s in staff_list)
        total_needed = 0
        for d in week_dates:
            day_type = _get_day_type(d)
            for t in slots:
                total_needed += req_map.get((t.id, day_type), 0)
        if total_needed > total_capacity:
            diagnostics.append(DiagnosticItem(
                constraint="C5_weekly_max",
                severity="error",
                message=f"週 {week_start.isoformat()} 開始: 必要延べ人日({total_needed})がスタッフの週勤務上限合計({total_capacity})を超えています。",
            ))

    # ロール別人数チェック（B5有効時）
    if config.enable_role_staffing and role_requirements:
        for rr in role_requirements:
            eligible = [s for s in staff_list if s.role == rr.role]
            if len(eligible) < rr.min_count:
                diagnostics.append(DiagnosticItem(
                    constraint="B5_role_staffing",
                    severity="error",
                    message=f"ロール「{rr.role}」のスタッフ数({len(eligible)}人)が必要人数({rr.min_count}人)に不足しています。",
                ))

    return diagnostics


def _try_solve_relaxed(
    period: SchedulePeriod,
    staff_list: list[Staff],
    slots: list[ShiftSlot],
    requirements: list[StaffingRequirement],
    requests: list[StaffRequest],
    config: SolverConfig,
    role_requirements: list[RoleStaffingRequirement],
) -> list[DiagnosticItem]:
    """制約を1つずつ緩和して再ソルブし、原因制約を特定"""
    diagnostics: list[DiagnosticItem] = []

    relaxations: list[tuple[str, str, dict]] = [
        (
            "C2_staffing",
            "必要人数の設定を見直すか、「必要人数のソフト制約化」を有効にしてください。",
            {"enable_soft_staffing": True},
        ),
        (
            "C4_consecutive",
            "連勤制限の上限を引き上げてください。",
            {"max_consecutive_days": 999},
        ),
        (
            "C5_weekly_max",
            "スタッフの週勤務上限を引き上げてください。",
            {"override_max_days_per_week": 7},
        ),
        (
            "B4_interval",
            "シフト間インターバルを短縮するか、無効にしてください。",
            {"enable_shift_interval": False},
        ),
        (
            "B5_role_staffing",
            "ロール別必要人数の設定を見直してください。",
            {"enable_role_staffing": False},
        ),
        (
            "B6_min_days",
            "最低勤務日数の設定を引き下げてください。",
            {"enable_min_days_per_week": False},
        ),
    ]

    # C3: 不可日の緩和は特殊処理
    has_unavailable = any(r.type == "unavailable" for r in requests)

    resolved_any = False

    for constraint_name, message, overrides in relaxations:
        relaxed_config = deepcopy(config)
        relaxed_staff = staff_list
        relaxed_requests = requests

        # 既にその設定が無効/緩和済みならスキップ
        if constraint_name == "B4_interval" and not config.enable_shift_interval:
            continue
        if constraint_name == "B5_role_staffing" and not config.enable_role_staffing:
            continue
        if constraint_name == "B6_min_days" and not config.enable_min_days_per_week:
            continue
        if constraint_name == "C2_staffing" and config.enable_soft_staffing:
            continue

        if "override_max_days_per_week" in overrides:
            relaxed_staff = [
                Staff(
                    id=s.id, name=s.name, role=s.role,
                    max_days_per_week=7, min_days_per_week=s.min_days_per_week,
                )
                for s in staff_list
            ]
        else:
            for key, val in overrides.items():
                setattr(relaxed_config, key, val)

        result = solve_schedule(
            period=period,
            staff_list=relaxed_staff,
            slots=slots,
            requirements=requirements,
            requests=relaxed_requests,
            config=relaxed_config,
            role_requirements=role_requirements,
            _skip_diagnostics=True,
        )
        if result["status"] == "optimal":
            diagnostics.append(DiagnosticItem(
                constraint=constraint_name,
                severity="error",
                message=message,
            ))
            resolved_any = True

    # C3: 不可日の緩和テスト
    if has_unavailable:
        relaxed_requests = [r for r in requests if r.type != "unavailable"]
        result = solve_schedule(
            period=period,
            staff_list=staff_list,
            slots=slots,
            requirements=requirements,
            requests=relaxed_requests,
            config=config,
            role_requirements=role_requirements,
            _skip_diagnostics=True,
        )
        if result["status"] == "optimal":
            diagnostics.append(DiagnosticItem(
                constraint="C3_unavailable",
                severity="error",
                message="不可日の登録が多すぎる可能性があります。スタッフの不可日を見直してください。",
            ))
            resolved_any = True

    if not resolved_any:
        diagnostics.append(DiagnosticItem(
            constraint="combined",
            severity="error",
            message="複数の制約の組み合わせが原因の可能性があります。制約設定を全体的に見直してください。",
        ))

    return diagnostics


def diagnose_infeasibility(
    period: SchedulePeriod,
    staff_list: list[Staff],
    slots: list[ShiftSlot],
    requirements: list[StaffingRequirement],
    requests: list[StaffRequest],
    config: SolverConfig,
    role_requirements: list[RoleStaffingRequirement],
) -> list[DiagnosticItem]:
    """infeasible 時に原因を特定する診断を実行"""
    num_days = (period.end_date - period.start_date).days + 1
    dates = [period.start_date + timedelta(days=i) for i in range(num_days)]

    # Phase 1: プリソルブチェック
    presolve = _presolve_checks(
        dates, staff_list, slots, requirements, requests, config, role_requirements,
    )
    if presolve:
        return presolve

    # Phase 2: 制約緩和テスト
    return _try_solve_relaxed(
        period, staff_list, slots, requirements, requests, config, role_requirements,
    )


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
    _skip_diagnostics: bool = False,
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
        # status 0 = Not Solved (timeout), -1 = Infeasible
        if prob.status == 0:
            return {
                "status": "timeout",
                "message": "制限時間内に解が見つかりませんでした。制限時間を延長するか、制約を緩和してください。",
                "assignments": [],
                "diagnostics": [DiagnosticItem(
                    constraint="timeout",
                    severity="warning",
                    message=f"制限時間({config.time_limit}秒)内に解が見つかりませんでした。設定画面で制限時間を延長してください。",
                )] if not _skip_diagnostics else [],
            }

        # Infeasible: run diagnostics
        diagnostics: list[DiagnosticItem] = []
        if not _skip_diagnostics:
            diagnostics = diagnose_infeasibility(
                period, staff_list, slots, requirements, requests,
                config, role_requirements if role_requirements else [],
            )
        return {
            "status": "infeasible",
            "message": "実行可能なシフトが見つかりませんでした。下記の診断結果を確認してください。" if diagnostics else "実行可能なシフトが見つかりませんでした。制約を緩和してください。",
            "assignments": [],
            "diagnostics": diagnostics,
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
        "diagnostics": [],
    }
