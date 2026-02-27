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


def test_get_published_period_ending_before(client, db_session):
    """直前に公開済み期間が存在する場合に返すことを確認"""
    from datetime import date
    from backend.models import SchedulePeriodModel
    from backend.repositories import ScheduleRepository

    # 公開済み期間（3月）を作成
    march = SchedulePeriodModel(
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 31),
        status="published",
    )
    db_session.add(march)
    db_session.commit()

    repo = ScheduleRepository(db_session)

    # 4月のスケジュールを最適化する際に3月を見つける
    result = repo.get_published_period_ending_before(date(2026, 4, 1))
    assert result is not None
    assert result.end_date == date(2026, 3, 31)


def test_get_published_period_ending_before_not_found(client, db_session):
    """直前に公開済み期間がない場合は None を返すことを確認"""
    from datetime import date
    from backend.repositories import ScheduleRepository

    repo = ScheduleRepository(db_session)
    result = repo.get_published_period_ending_before(date(2026, 4, 1))
    assert result is None
