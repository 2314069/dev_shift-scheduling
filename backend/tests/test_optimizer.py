import pytest
from datetime import date, time
from collections import Counter, defaultdict

from backend.domain import (
    DiagnosticItem,
    RoleStaffingRequirement,
    SolverConfig,
    Staff,
    ShiftSlot,
    StaffRequest,
    SchedulePeriod,
    StaffingRequirement,
)
from backend.optimizer.solver import solve_schedule


def _setup_basic_scenario():
    """3人のスタッフ、1シフト枠、3日間、各日2人必要"""
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=5),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5),
        Staff(id=3, name="鈴木", role="一般", max_days_per_week=5),
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(
        id=1,
        start_date=date(2026, 3, 2),  # Monday
        end_date=date(2026, 3, 4),    # Wednesday
    )
    return period, staff_list, slots, requirements


def test_basic_schedule_feasible():
    period, staff_list, slots, requirements = _setup_basic_scenario()
    result = solve_schedule(period, staff_list, slots, requirements, [])
    assert result["status"] == "optimal"
    assert len(result["assignments"]) > 0

    # 各日に2人以上割り当てられていることを確認
    day_counts = Counter(a["date"] for a in result["assignments"])
    for d, count in day_counts.items():
        assert count >= 2


def test_unavailable_respected():
    period, staff_list, slots, requirements = _setup_basic_scenario()

    # 田中(id=1)は3/2が不可
    requests = [
        StaffRequest(
            id=1,
            staff_id=1,
            date=date(2026, 3, 2),
            type="unavailable",
        )
    ]

    result = solve_schedule(period, staff_list, slots, requirements, requests)
    assert result["status"] == "optimal"

    # 田中が3/2に割り当てられていないことを確認
    for a in result["assignments"]:
        if a["staff_id"] == 1 and a["date"] == "2026-03-02":
            pytest.fail("Unavailable staff was assigned")


def test_max_consecutive_days_respected():
    """7日間のスケジュールで連勤制限を確認"""
    staff_list = [
        Staff(id=i, name=f"スタッフ{i}", role="一般", max_days_per_week=5)
        for i in range(1, 5)
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(
        id=1,
        start_date=date(2026, 3, 2),   # Monday
        end_date=date(2026, 3, 8),     # Sunday (7 days)
    )

    result = solve_schedule(
        period, staff_list, slots, requirements, [], max_consecutive_days=5
    )
    assert result["status"] == "optimal"

    # 各スタッフが6連勤以上していないことを確認
    staff_dates = defaultdict(set)
    for a in result["assignments"]:
        staff_dates[a["staff_id"]].add(a["date"])

    for s_id, dates in staff_dates.items():
        sorted_dates = sorted(dates)
        consecutive = 1
        for i in range(1, len(sorted_dates)):
            d1 = date.fromisoformat(sorted_dates[i - 1])
            d2 = date.fromisoformat(sorted_dates[i])
            if (d2 - d1).days == 1:
                consecutive += 1
                assert consecutive <= 5, f"Staff {s_id} has {consecutive} consecutive days"
            else:
                consecutive = 1


def test_infeasible_returns_infeasible():
    """1人しかいないのに2人必要な場合、infeasibleになる"""
    staff_list = [Staff(id=1, name="田中", role="一般", max_days_per_week=5)]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(
        id=1,
        start_date=date(2026, 3, 2),
        end_date=date(2026, 3, 2),
    )

    result = solve_schedule(period, staff_list, slots, requirements, [])
    assert result["status"] == "infeasible"


def test_weekly_max_days_respected():
    """週あたり勤務上限を確認"""
    staff_list = [
        Staff(id=i, name=f"スタッフ{i}", role="一般", max_days_per_week=3)
        for i in range(1, 5)
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(
        id=1,
        start_date=date(2026, 3, 2),   # Monday
        end_date=date(2026, 3, 6),     # Friday (5 weekdays)
    )

    result = solve_schedule(period, staff_list, slots, requirements, [])
    assert result["status"] == "optimal"

    # 各スタッフの勤務日数が3日以下であることを確認
    staff_counts = Counter(a["staff_id"] for a in result["assignments"])
    for s_id, count in staff_counts.items():
        assert count <= 3, f"Staff {s_id} has {count} days (max 3)"


# === A1: 希望シフト反映 ===

def test_preferred_shift_enabled():
    """希望シフト反映が有効な場合、preferred な日にスタッフが割り当てられる"""
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=5),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5),
        Staff(id=3, name="鈴木", role="一般", max_days_per_week=5),
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=1)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 4))

    # 田中は3/2を希望
    requests = [
        StaffRequest(id=1, staff_id=1, date=date(2026, 3, 2), type="preferred", shift_slot_id=1),
    ]

    config = SolverConfig(id=0, enable_preferred_shift=True, weight_preferred=3.0)
    result = solve_schedule(period, staff_list, slots, requirements, requests, config=config)
    assert result["status"] == "optimal"

    # 田中が3/2に割り当てられていることを確認
    assigned_3_2 = [a for a in result["assignments"] if a["date"] == "2026-03-02"]
    staff_ids_3_2 = [a["staff_id"] for a in assigned_3_2]
    assert 1 in staff_ids_3_2


def test_preferred_shift_disabled():
    """希望シフト反映が無効な場合でもスケジュールは正常に生成される"""
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=5),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5),
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=1)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 3))

    requests = [
        StaffRequest(id=1, staff_id=1, date=date(2026, 3, 2), type="preferred", shift_slot_id=1),
    ]

    config = SolverConfig(id=0, enable_preferred_shift=False)
    result = solve_schedule(period, staff_list, slots, requirements, requests, config=config)
    assert result["status"] == "optimal"


# === A2: 公平性（均等配分） ===

def test_fairness_enabled():
    """公平性が有効な場合、スタッフ間の勤務日数差が小さくなる"""
    staff_list = [
        Staff(id=i, name=f"スタッフ{i}", role="一般", max_days_per_week=5)
        for i in range(1, 5)
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 6))

    config = SolverConfig(id=0, enable_fairness=True, weight_fairness=2.0)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    assert result["status"] == "optimal"

    # 勤務日数の最大差が2以下であることを確認
    staff_counts = Counter(a["staff_id"] for a in result["assignments"])
    counts = list(staff_counts.values())
    if counts:
        assert max(counts) - min(counts) <= 2


def test_fairness_disabled():
    """公平性が無効な場合でもスケジュールは正常に生成される"""
    staff_list = [
        Staff(id=i, name=f"スタッフ{i}", role="一般", max_days_per_week=5)
        for i in range(1, 4)
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 4))

    config = SolverConfig(id=0, enable_fairness=False)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    assert result["status"] == "optimal"


# === A3: 土日祝の公平配分 ===

def test_weekend_fairness_enabled():
    """土日公平配分が有効な場合、土日のスタッフ間差が小さくなる"""
    staff_list = [
        Staff(id=i, name=f"スタッフ{i}", role="一般", max_days_per_week=6)
        for i in range(1, 5)
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [
        StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2),
        StaffingRequirement(id=2, shift_slot_id=1, day_type="weekend", min_count=2),
    ]
    # Mon-Sun (7 days, includes Sat/Sun)
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 8))

    config = SolverConfig(id=0, enable_weekend_fairness=True, weight_weekend_fairness=2.0)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    assert result["status"] == "optimal"

    # 土日の勤務日数を集計
    weekend_counts = Counter()
    for a in result["assignments"]:
        d = date.fromisoformat(a["date"])
        if d.weekday() >= 5:
            weekend_counts[a["staff_id"]] += 1
    counts = list(weekend_counts.values())
    if counts:
        assert max(counts) - min(counts) <= 1


def test_weekend_fairness_disabled():
    """土日公平配分が無効でも正常にスケジュール生成される"""
    staff_list = [
        Staff(id=i, name=f"スタッフ{i}", role="一般", max_days_per_week=6)
        for i in range(1, 4)
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [
        StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2),
        StaffingRequirement(id=2, shift_slot_id=1, day_type="weekend", min_count=2),
    ]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 8))

    config = SolverConfig(id=0, enable_weekend_fairness=False)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    assert result["status"] == "optimal"


# === B4: シフト間インターバル ===

def test_shift_interval_enabled():
    """遅番→翌日早番がインターバル違反の場合、禁止される"""
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=5),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5),
    ]
    slots = [
        ShiftSlot(id=1, name="早番", start_time=time(7, 0), end_time=time(15, 0)),
        ShiftSlot(id=2, name="遅番", start_time=time(15, 0), end_time=time(23, 0)),
    ]
    requirements = [
        StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=1),
        StaffingRequirement(id=2, shift_slot_id=2, day_type="weekday", min_count=1),
    ]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 3))

    config = SolverConfig(id=0, enable_shift_interval=True, min_shift_interval_hours=11)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    assert result["status"] == "optimal"

    # 遅番(23:00終)→翌早番(7:00始) = 8時間 < 11時間 なので同一スタッフに割り当てられない
    staff_assignments = defaultdict(list)
    for a in result["assignments"]:
        staff_assignments[a["staff_id"]].append((a["date"], a["shift_slot_id"]))

    for s_id, assigns in staff_assignments.items():
        assigns_sorted = sorted(assigns)
        for i in range(len(assigns_sorted) - 1):
            d1, t1 = assigns_sorted[i]
            d2, t2 = assigns_sorted[i + 1]
            # 遅番→翌日早番は禁止
            if t1 == 2 and t2 == 1:
                d1_date = date.fromisoformat(d1) if isinstance(d1, str) else d1
                d2_date = date.fromisoformat(d2) if isinstance(d2, str) else d2
                assert (d2_date - d1_date).days != 1, f"Staff {s_id}: 遅番→翌早番が割り当て"


def test_shift_interval_disabled():
    """インターバル制約が無効な場合でも正常にスケジュール生成"""
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=5),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5),
    ]
    slots = [
        ShiftSlot(id=1, name="早番", start_time=time(7, 0), end_time=time(15, 0)),
        ShiftSlot(id=2, name="遅番", start_time=time(15, 0), end_time=time(23, 0)),
    ]
    requirements = [
        StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=1),
        StaffingRequirement(id=2, shift_slot_id=2, day_type="weekday", min_count=1),
    ]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 3))

    config = SolverConfig(id=0, enable_shift_interval=False)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    assert result["status"] == "optimal"


# === B5: ロール別必要人数 ===

def test_role_staffing_enabled():
    """ロール別必要人数が有効な場合、各ロールの最低人数が確保される"""
    staff_list = [
        Staff(id=1, name="田中", role="リーダー", max_days_per_week=5),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5),
        Staff(id=3, name="鈴木", role="一般", max_days_per_week=5),
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 4))

    role_reqs = [
        RoleStaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", role="リーダー", min_count=1),
    ]

    config = SolverConfig(id=0, enable_role_staffing=True)
    result = solve_schedule(
        period, staff_list, slots, requirements, [],
        config=config, role_requirements=role_reqs,
    )
    assert result["status"] == "optimal"

    # 各平日にリーダーが最低1人いることを確認
    for d_str in ["2026-03-02", "2026-03-03", "2026-03-04"]:
        day_assignments = [a for a in result["assignments"] if a["date"] == d_str]
        leader_count = sum(1 for a in day_assignments if a["staff_id"] == 1)
        assert leader_count >= 1, f"{d_str} にリーダーが不足"


def test_role_staffing_disabled():
    """ロール別必要人数が無効の場合でも正常にスケジュール生成"""
    staff_list = [
        Staff(id=1, name="田中", role="リーダー", max_days_per_week=5),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5),
        Staff(id=3, name="鈴木", role="一般", max_days_per_week=5),
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 4))

    config = SolverConfig(id=0, enable_role_staffing=False)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    assert result["status"] == "optimal"


# === B6: 最低勤務日数/週 ===

def test_min_days_per_week_enabled():
    """最低勤務日数が有効な場合、各スタッフの週あたり最低日数が確保される"""
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=5, min_days_per_week=2),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5, min_days_per_week=2),
        Staff(id=3, name="鈴木", role="一般", max_days_per_week=5, min_days_per_week=0),
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 6))

    config = SolverConfig(id=0, enable_min_days_per_week=True)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    assert result["status"] == "optimal"

    # 田中・佐藤が各週2日以上であること
    for s_id in [1, 2]:
        count = sum(1 for a in result["assignments"] if a["staff_id"] == s_id)
        assert count >= 2, f"Staff {s_id} has {count} days (min 2)"


def test_min_days_per_week_disabled():
    """最低勤務日数が無効でも正常にスケジュール生成"""
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=5, min_days_per_week=2),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5),
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=1)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 4))

    config = SolverConfig(id=0, enable_min_days_per_week=False)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    assert result["status"] == "optimal"


# === C7: 必要人数のソフト制約化 ===

def test_soft_staffing_enabled():
    """ソフト制約化が有効な場合、人数不足でもinfeasibleにならない"""
    # 1人しかいないのに2人必要 → ハードならinfeasible、ソフトならoptimal
    staff_list = [Staff(id=1, name="田中", role="一般", max_days_per_week=5)]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 2))

    config = SolverConfig(id=0, enable_soft_staffing=True, weight_soft_staffing=10.0)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    assert result["status"] == "optimal"


def test_soft_staffing_disabled():
    """ソフト制約化が無効（デフォルト）の場合、人数不足はinfeasible"""
    staff_list = [Staff(id=1, name="田中", role="一般", max_days_per_week=5)]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 2))

    config = SolverConfig(id=0, enable_soft_staffing=False)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)
    assert result["status"] == "infeasible"


# === 結合テスト: 全機能有効 ===

def test_all_features_enabled():
    """全機能を有効にした場合でも正常にスケジュールが生成される"""
    staff_list = [
        Staff(id=1, name="田中", role="リーダー", max_days_per_week=5, min_days_per_week=2),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5, min_days_per_week=2),
        Staff(id=3, name="鈴木", role="一般", max_days_per_week=5, min_days_per_week=0),
        Staff(id=4, name="山田", role="一般", max_days_per_week=5, min_days_per_week=0),
    ]
    slots = [
        ShiftSlot(id=1, name="早番", start_time=time(7, 0), end_time=time(15, 0)),
        ShiftSlot(id=2, name="遅番", start_time=time(15, 0), end_time=time(23, 0)),
    ]
    requirements = [
        StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=1),
        StaffingRequirement(id=2, shift_slot_id=2, day_type="weekday", min_count=1),
        StaffingRequirement(id=3, shift_slot_id=1, day_type="weekend", min_count=1),
        StaffingRequirement(id=4, shift_slot_id=2, day_type="weekend", min_count=1),
    ]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 8))

    requests = [
        StaffRequest(id=1, staff_id=1, date=date(2026, 3, 3), type="preferred", shift_slot_id=1),
        StaffRequest(id=2, staff_id=2, date=date(2026, 3, 5), type="unavailable"),
    ]

    role_reqs = [
        RoleStaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", role="リーダー", min_count=1),
    ]

    config = SolverConfig(
        id=0,
        enable_preferred_shift=True,
        enable_fairness=True,
        enable_weekend_fairness=True,
        enable_shift_interval=True,
        enable_role_staffing=True,
        enable_min_days_per_week=True,
        enable_soft_staffing=False,
        min_shift_interval_hours=11,
    )

    result = solve_schedule(
        period, staff_list, slots, requirements, requests,
        config=config, role_requirements=role_reqs,
    )
    assert result["status"] == "optimal"
    assert len(result["assignments"]) > 0


# === 診断テスト ===

def test_diagnostics_c2_staffing_shortage():
    """人数不足時に C2_staffing の診断が返る"""
    staff_list = [Staff(id=1, name="田中", role="一般", max_days_per_week=5)]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 2))

    config = SolverConfig(id=0, enable_soft_staffing=False)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)

    assert result["status"] == "infeasible"
    assert len(result["diagnostics"]) > 0
    constraints = [d.constraint for d in result["diagnostics"]]
    assert "C2_staffing" in constraints


def test_diagnostics_c5_weekly_max():
    """週上限が厳しすぎる場合に C5_weekly_max の診断が返る"""
    # 2人、週1日上限、5日間で毎日2人必要 → 合計10人日必要 vs 容量2人日
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=1),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=1),
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 6))

    config = SolverConfig(id=0)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)

    assert result["status"] == "infeasible"
    assert len(result["diagnostics"]) > 0
    constraints = [d.constraint for d in result["diagnostics"]]
    assert "C5_weekly_max" in constraints


def test_diagnostics_c4_consecutive():
    """連勤制限起因の infeasible で C4_consecutive 診断が返る"""
    # 1人で7日間毎日1人必要、連勤制限3日 → infeasible
    staff_list = [Staff(id=1, name="田中", role="一般", max_days_per_week=7)]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [
        StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=1),
        StaffingRequirement(id=2, shift_slot_id=1, day_type="weekend", min_count=1),
    ]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 8))

    config = SolverConfig(id=0, max_consecutive_days=3)
    result = solve_schedule(period, staff_list, slots, requirements, [], config=config)

    assert result["status"] == "infeasible"
    assert len(result["diagnostics"]) > 0
    constraints = [d.constraint for d in result["diagnostics"]]
    assert "C4_consecutive" in constraints


def test_diagnostics_empty_on_optimal():
    """正常時は diagnostics が空"""
    period, staff_list, slots, requirements = _setup_basic_scenario()
    result = solve_schedule(period, staff_list, slots, requirements, [])

    assert result["status"] == "optimal"
    assert result["diagnostics"] == []


def test_diagnostics_c3_unavailable():
    """不可日が多すぎて infeasible になった場合に C3_unavailable 診断が返る"""
    # 2人スタッフ、毎日2人必要、両方が1日不可
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=5),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=5),
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    period = SchedulePeriod(id=1, start_date=date(2026, 3, 2), end_date=date(2026, 3, 2))

    requests = [
        StaffRequest(id=1, staff_id=1, date=date(2026, 3, 2), type="unavailable"),
    ]

    config = SolverConfig(id=0)
    result = solve_schedule(period, staff_list, slots, requirements, requests, config=config)

    assert result["status"] == "infeasible"
    assert len(result["diagnostics"]) > 0
    constraints = [d.constraint for d in result["diagnostics"]]
    assert "C3_unavailable" in constraints


def test_cross_month_consecutive_days_respected():
    """月またぎの連続勤務制限を確認"""
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=7),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=7),
        Staff(id=3, name="鈴木", role="一般", max_days_per_week=7),
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    # 4月1日（水）〜7日（火）
    period = SchedulePeriod(id=1, start_date=date(2026, 4, 1), end_date=date(2026, 4, 7))

    # 田中は3月29〜31日（3日間）すでに連続勤務済み。max_consecutive_days=4 なら今月は最初の1日だけ可
    prefix_assignments = {
        1: [date(2026, 3, 29), date(2026, 3, 30), date(2026, 3, 31)],
    }

    config = SolverConfig(
        id=1,
        max_consecutive_days=4,
        time_limit=30,
        min_shift_interval_hours=11,
        enable_preferred_shift=False,
        enable_fairness=False,
        enable_weekend_fairness=False,
        enable_shift_interval=False,
        enable_role_staffing=False,
        enable_min_days_per_week=False,
        enable_soft_staffing=False,
    )

    result = solve_schedule(
        period, staff_list, slots, requirements, [],
        config=config,
        prefix_assignments=prefix_assignments,
    )
    assert result["status"] == "optimal"

    # 田中の全勤務日（prefix含む）を結合して連続勤務が4日以下であることを確認
    prefix_dates_set = set(prefix_assignments[1])
    tanaka_work_dates = sorted(
        date.fromisoformat(a["date"])
        for a in result["assignments"]
        if a["staff_id"] == 1
    )

    # prefix + 今月の勤務日を全部並べて、max_consecutive_days を超える連続がないか検証
    all_dates = sorted(prefix_dates_set | set(tanaka_work_dates))
    if all_dates:
        max_run = 1
        current_run = 1
        for i in range(1, len(all_dates)):
            if (all_dates[i] - all_dates[i - 1]).days == 1:
                current_run += 1
                max_run = max(max_run, current_run)
            else:
                current_run = 1
        assert max_run <= config.max_consecutive_days, (
            f"Cross-month consecutive limit violated: {max_run} consecutive days (max {config.max_consecutive_days})"
        )
