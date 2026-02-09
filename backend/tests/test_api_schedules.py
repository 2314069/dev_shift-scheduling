def test_create_schedule_period(client):
    response = client.post(
        "/api/schedules",
        json={"start_date": "2026-03-01", "end_date": "2026-03-15"},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "draft"


def test_get_schedule(client):
    res = client.post(
        "/api/schedules",
        json={"start_date": "2026-03-01", "end_date": "2026-03-15"},
    )
    period_id = res.json()["id"]
    response = client.get(f"/api/schedules/{period_id}")
    assert response.status_code == 200
    assert response.json()["period"]["id"] == period_id
    assert response.json()["assignments"] == []


def test_publish_schedule(client):
    res = client.post(
        "/api/schedules",
        json={"start_date": "2026-03-01", "end_date": "2026-03-15"},
    )
    period_id = res.json()["id"]
    response = client.put(f"/api/schedules/{period_id}/publish")
    assert response.status_code == 200
    assert response.json()["status"] == "published"
