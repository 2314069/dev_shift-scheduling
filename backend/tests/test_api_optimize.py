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
