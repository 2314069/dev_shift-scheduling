def test_create_shift_slot(client):
    response = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    assert response.status_code == 201
    assert response.json()["name"] == "早番"


def test_list_shift_slots(client):
    client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    client.post(
        "/api/shift-slots",
        json={"name": "遅番", "start_time": "13:00:00", "end_time": "21:00:00"},
    )
    response = client.get("/api/shift-slots")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_shift_slot(client):
    res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    slot_id = res.json()["id"]
    response = client.put(f"/api/shift-slots/{slot_id}", json={"name": "朝番"})
    assert response.status_code == 200
    assert response.json()["name"] == "朝番"


def test_delete_shift_slot(client):
    res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    slot_id = res.json()["id"]
    response = client.delete(f"/api/shift-slots/{slot_id}")
    assert response.status_code == 204
