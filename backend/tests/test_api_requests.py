def _setup_data(client):
    staff_res = client.post("/api/staff", json={"name": "田中", "role": "一般"})
    slot_res = client.post(
        "/api/shift-slots",
        json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"},
    )
    period_res = client.post(
        "/api/schedules",
        json={"start_date": "2026-03-01", "end_date": "2026-03-15"},
    )
    return staff_res.json()["id"], slot_res.json()["id"], period_res.json()["id"]


def test_bulk_create_requests(client):
    staff_id, slot_id, period_id = _setup_data(client)
    response = client.post(
        "/api/requests",
        json={
            "period_id": period_id,
            "requests": [
                {
                    "staff_id": staff_id,
                    "date": "2026-03-01",
                    "shift_slot_id": slot_id,
                    "type": "preferred",
                },
                {
                    "staff_id": staff_id,
                    "date": "2026-03-02",
                    "shift_slot_id": None,
                    "type": "unavailable",
                },
            ],
        },
    )
    assert response.status_code == 201
    assert len(response.json()) == 2


def test_list_requests_by_period(client):
    staff_id, slot_id, period_id = _setup_data(client)
    client.post(
        "/api/requests",
        json={
            "period_id": period_id,
            "requests": [
                {
                    "staff_id": staff_id,
                    "date": "2026-03-01",
                    "type": "unavailable",
                },
            ],
        },
    )
    response = client.get(f"/api/requests?period_id={period_id}")
    assert response.status_code == 200
    assert len(response.json()) == 1
