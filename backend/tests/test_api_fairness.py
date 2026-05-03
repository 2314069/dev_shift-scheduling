from datetime import date

import pytest

from backend.models import (
    ScheduleAssignmentModel,
    SchedulePeriodModel,
    ShiftSlotModel,
    StaffModel,
)
from tests.conftest import TEST_ORG_ID


# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

def _create_staff(db_session, name: str) -> StaffModel:
    staff = StaffModel(
        organization_id=TEST_ORG_ID,
        name=name,
        role="一般",
        max_days_per_week=5,
        min_days_per_week=0,
    )
    db_session.add(staff)
    db_session.flush()
    return staff


def _create_slot(db_session, name: str) -> ShiftSlotModel:
    from datetime import time

    slot = ShiftSlotModel(
        organization_id=TEST_ORG_ID,
        name=name,
        start_time=time(9, 0),
        end_time=time(17, 0),
    )
    db_session.add(slot)
    db_session.flush()
    return slot


def _create_period(db_session, start: date, end: date) -> SchedulePeriodModel:
    period = SchedulePeriodModel(
        organization_id=TEST_ORG_ID,
        start_date=start,
        end_date=end,
        status="draft",
    )
    db_session.add(period)
    db_session.flush()
    return period


def _create_assignment(
    db_session,
    period_id: int,
    staff_id: int,
    assign_date: date,
    shift_slot_id: int | None,
) -> ScheduleAssignmentModel:
    assignment = ScheduleAssignmentModel(
        organization_id=TEST_ORG_ID,
        period_id=period_id,
        staff_id=staff_id,
        date=assign_date,
        shift_slot_id=shift_slot_id,
        is_manual_edit=False,
    )
    db_session.add(assignment)
    db_session.flush()
    return assignment


# ---------------------------------------------------------------------------
# テストケース
# ---------------------------------------------------------------------------

def test_fairness_404_for_missing_period(client):
    """存在しない期間 ID は 404 を返すこと。"""
    response = client.get("/api/schedules/9999/fairness")
    assert response.status_code == 404


def test_fairness_empty_assignments(client, db_session):
    """アサインメントが存在しない期間の場合、空のメトリクスと 0 の平均を返すこと。"""
    period = _create_period(db_session, date(2026, 4, 1), date(2026, 4, 30))
    db_session.commit()

    response = client.get(f"/api/schedules/{period.id}/fairness")
    assert response.status_code == 200

    data = response.json()
    assert data["staff_metrics"] == []
    assert data["summary"]["avg_total"] == 0.0
    assert data["summary"]["avg_early"] == 0.0
    assert data["summary"]["avg_late"] == 0.0
    assert data["summary"]["avg_weekend"] == 0.0


def test_fairness_shift_slot_none_excluded(client, db_session):
    """shift_slot_id が None（休み）のアサインメントはカウントしないこと。"""
    period = _create_period(db_session, date(2026, 4, 1), date(2026, 4, 30))
    staff = _create_staff(db_session, "山田花子")
    # shift_slot_id=None → 休み扱い、カウントされない
    _create_assignment(db_session, period.id, staff.id, date(2026, 4, 7), None)
    db_session.commit()

    response = client.get(f"/api/schedules/{period.id}/fairness")
    assert response.status_code == 200

    data = response.json()
    # 出勤ゼロなのでスタッフメトリクスは空
    assert data["staff_metrics"] == []


def test_fairness_early_late_other_classification(client, db_session):
    """早番・遅番・夜番・その他が正しく分類されること。"""
    period = _create_period(db_session, date(2026, 4, 1), date(2026, 4, 30))
    staff = _create_staff(db_session, "田中太郎")

    early_slot = _create_slot(db_session, "早番A")
    late_slot = _create_slot(db_session, "遅番B")
    night_slot = _create_slot(db_session, "夜勤")
    other_slot = _create_slot(db_session, "通常")

    # 平日（月曜 = 2026-04-06）にアサイン
    _create_assignment(db_session, period.id, staff.id, date(2026, 4, 6), early_slot.id)
    _create_assignment(db_session, period.id, staff.id, date(2026, 4, 7), late_slot.id)
    _create_assignment(db_session, period.id, staff.id, date(2026, 4, 8), night_slot.id)
    _create_assignment(db_session, period.id, staff.id, date(2026, 4, 9), other_slot.id)
    db_session.commit()

    response = client.get(f"/api/schedules/{period.id}/fairness")
    assert response.status_code == 200

    metrics = response.json()["staff_metrics"]
    assert len(metrics) == 1
    m = metrics[0]

    assert m["staff_id"] == staff.id
    assert m["staff_name"] == "田中太郎"
    assert m["total_shifts"] == 4
    assert m["early_shifts"] == 1   # 早番A
    assert m["late_shifts"] == 2    # 遅番B + 夜勤
    assert m["other_shifts"] == 1   # 通常
    assert m["weekend_shifts"] == 0  # すべて平日


def test_fairness_weekend_shifts(client, db_session):
    """土日のアサインメントが weekend_shifts にカウントされること。"""
    period = _create_period(db_session, date(2026, 4, 1), date(2026, 4, 30))
    staff = _create_staff(db_session, "鈴木次郎")
    slot = _create_slot(db_session, "通常")

    # 2026-04-04(土), 2026-04-05(日), 2026-04-06(月)
    _create_assignment(db_session, period.id, staff.id, date(2026, 4, 4), slot.id)  # 土
    _create_assignment(db_session, period.id, staff.id, date(2026, 4, 5), slot.id)  # 日
    _create_assignment(db_session, period.id, staff.id, date(2026, 4, 6), slot.id)  # 月
    db_session.commit()

    response = client.get(f"/api/schedules/{period.id}/fairness")
    assert response.status_code == 200

    m = response.json()["staff_metrics"][0]
    assert m["total_shifts"] == 3
    assert m["weekend_shifts"] == 2  # 土・日のみ


def test_fairness_summary_averages(client, db_session):
    """複数スタッフの平均値が正しく計算されること。"""
    period = _create_period(db_session, date(2026, 4, 1), date(2026, 4, 30))
    staff_a = _create_staff(db_session, "スタッフA")
    staff_b = _create_staff(db_session, "スタッフB")
    early_slot = _create_slot(db_session, "早番")

    # staff_a: 早番 2回（平日）
    _create_assignment(db_session, period.id, staff_a.id, date(2026, 4, 6), early_slot.id)
    _create_assignment(db_session, period.id, staff_a.id, date(2026, 4, 7), early_slot.id)

    # staff_b: 早番 4回（平日）
    _create_assignment(db_session, period.id, staff_b.id, date(2026, 4, 8), early_slot.id)
    _create_assignment(db_session, period.id, staff_b.id, date(2026, 4, 9), early_slot.id)
    _create_assignment(db_session, period.id, staff_b.id, date(2026, 4, 13), early_slot.id)
    _create_assignment(db_session, period.id, staff_b.id, date(2026, 4, 14), early_slot.id)
    db_session.commit()

    response = client.get(f"/api/schedules/{period.id}/fairness")
    assert response.status_code == 200

    summary = response.json()["summary"]
    # avg_total: (2 + 4) / 2 = 3.0
    assert summary["avg_total"] == pytest.approx(3.0)
    # avg_early: (2 + 4) / 2 = 3.0
    assert summary["avg_early"] == pytest.approx(3.0)
    # avg_late: (0 + 0) / 2 = 0.0
    assert summary["avg_late"] == pytest.approx(0.0)
    # avg_weekend: (0 + 0) / 2 = 0.0
    assert summary["avg_weekend"] == pytest.approx(0.0)


def test_fairness_multiple_staff_metrics_returned(client, db_session):
    """複数スタッフのメトリクスがそれぞれ返されること。"""
    period = _create_period(db_session, date(2026, 4, 1), date(2026, 4, 30))
    staff_a = _create_staff(db_session, "スタッフA")
    staff_b = _create_staff(db_session, "スタッフB")
    slot = _create_slot(db_session, "通常")

    _create_assignment(db_session, period.id, staff_a.id, date(2026, 4, 6), slot.id)
    _create_assignment(db_session, period.id, staff_b.id, date(2026, 4, 7), slot.id)
    _create_assignment(db_session, period.id, staff_b.id, date(2026, 4, 8), slot.id)
    db_session.commit()

    response = client.get(f"/api/schedules/{period.id}/fairness")
    assert response.status_code == 200

    metrics = response.json()["staff_metrics"]
    assert len(metrics) == 2

    by_id = {m["staff_id"]: m for m in metrics}
    assert by_id[staff_a.id]["total_shifts"] == 1
    assert by_id[staff_b.id]["total_shifts"] == 2
