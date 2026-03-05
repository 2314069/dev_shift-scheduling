def _setup_optimization_scenario(client):
    """最適化テスト用のデータをセットアップ"""
    # スタッフ3人
    for name in ["田中", "佐藤", "鈴木"]:
        client.post("/api/staff", json={"name": name, "role": "一般"})

    # シフト枠1つ
    slot_res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    slot_id = slot_res.json()["id"]

    # 必要人数
    client.post(
        "/api/staffing-requirements",
        json={"shift_slot_id": slot_id, "day_type": "weekday", "min_count": 2},
    )

    # スケジュール期間（3日間・平日）
    period_res = client.post(
        "/api/schedules",
        json={"start_date": "2026-03-02", "end_date": "2026-03-04"},
    )
    return period_res.json()["id"]


def test_optimize_schedule(client):
    period_id = _setup_optimization_scenario(client)
    response = client.post(f"/api/schedules/{period_id}/optimize")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "optimal"
    assert len(data["assignments"]) > 0


def test_optimize_saves_assignments(client):
    period_id = _setup_optimization_scenario(client)
    client.post(f"/api/schedules/{period_id}/optimize")

    # シフト表を取得して割り当てがDBに保存されていることを確認
    response = client.get(f"/api/schedules/{period_id}")
    assert len(response.json()["assignments"]) > 0


def test_optimize_with_previous_published_period(client, db_session):
    """直前に公開済み期間があっても 500 エラーにならないことを確認"""
    from datetime import date, time as dt_time
    from backend.models import (
        StaffModel, ShiftSlotModel, StaffingRequirementModel,
        SchedulePeriodModel, ScheduleAssignmentModel,
    )

    # スタッフ（十分な人数を確保）
    for i in range(3):
        s = StaffModel(name=f"スタッフ{i}", role="一般", max_days_per_week=7, min_days_per_week=0)
        db_session.add(s)
    db_session.flush()

    # シフト枠
    slot = ShiftSlotModel(name="早番", start_time=dt_time(9, 0), end_time=dt_time(17, 0))
    db_session.add(slot)
    db_session.flush()

    req = StaffingRequirementModel(shift_slot_id=slot.id, day_type="weekday", min_count=1)
    db_session.add(req)

    # 前月（公開済み）を作成
    prev = SchedulePeriodModel(
        start_date=date(2026, 3, 1), end_date=date(2026, 3, 31), status="published"
    )
    db_session.add(prev)
    db_session.flush()

    # 今月（draft）
    curr = SchedulePeriodModel(
        start_date=date(2026, 4, 1), end_date=date(2026, 4, 3), status="draft"
    )
    db_session.add(curr)
    db_session.commit()

    response = client.post(f"/api/schedules/{curr.id}/optimize")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("optimal", "infeasible")
