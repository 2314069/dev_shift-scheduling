def test_create_role_staffing_requirement(client):
    """ロール別必要人数を作成できる"""
    # シフト枠を作成
    slot_res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    slot_id = slot_res.json()["id"]

    res = client.post(
        "/api/role-staffing-requirements",
        json={
            "shift_slot_id": slot_id,
            "day_type": "weekday",
            "role": "リーダー",
            "min_count": 1,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["role"] == "リーダー"
    assert data["min_count"] == 1


def test_list_role_staffing_requirements(client):
    """ロール別必要人数の一覧を取得できる"""
    slot_res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    slot_id = slot_res.json()["id"]

    client.post(
        "/api/role-staffing-requirements",
        json={"shift_slot_id": slot_id, "day_type": "weekday", "role": "リーダー", "min_count": 1},
    )

    res = client.get("/api/role-staffing-requirements")
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_delete_role_staffing_requirement(client):
    """ロール別必要人数を削除できる"""
    slot_res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    slot_id = slot_res.json()["id"]

    create_res = client.post(
        "/api/role-staffing-requirements",
        json={"shift_slot_id": slot_id, "day_type": "weekday", "role": "リーダー", "min_count": 1},
    )
    req_id = create_res.json()["id"]

    res = client.delete(f"/api/role-staffing-requirements/{req_id}")
    assert res.status_code == 204

    # 削除されたことを確認
    list_res = client.get("/api/role-staffing-requirements")
    assert len(list_res.json()) == 0
