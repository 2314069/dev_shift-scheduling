def _create_shift_slot(client):
    res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    return res.json()["id"]


def test_create_staffing_requirement(client):
    slot_id = _create_shift_slot(client)
    response = client.post(
        "/api/staffing-requirements",
        json={"shift_slot_id": slot_id, "day_type": "weekday", "min_count": 3},
    )
    assert response.status_code == 201
    assert response.json()["min_count"] == 3


def test_list_staffing_requirements(client):
    slot_id = _create_shift_slot(client)
    client.post(
        "/api/staffing-requirements",
        json={"shift_slot_id": slot_id, "day_type": "weekday", "min_count": 3},
    )
    client.post(
        "/api/staffing-requirements",
        json={"shift_slot_id": slot_id, "day_type": "weekend", "min_count": 2},
    )
    response = client.get("/api/staffing-requirements")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_staffing_requirement(client):
    slot_id = _create_shift_slot(client)
    res = client.post(
        "/api/staffing-requirements",
        json={"shift_slot_id": slot_id, "day_type": "weekday", "min_count": 3},
    )
    req_id = res.json()["id"]
    response = client.put(
        f"/api/staffing-requirements/{req_id}", json={"min_count": 5}
    )
    assert response.status_code == 200
    assert response.json()["min_count"] == 5
