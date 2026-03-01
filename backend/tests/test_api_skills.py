import pytest


def test_staff_skills_crud(client):
    """スタッフスキルの CRUD テスト"""
    # スタッフを作成
    r = client.post("/api/staff", json={"name": "田中", "role": "調理師", "max_days_per_week": 5})
    assert r.status_code == 201
    staff_id = r.json()["id"]

    # スキル追加
    r = client.post(f"/api/staff/{staff_id}/skills", json={"skill": "調理師免許"})
    assert r.status_code == 201
    skill_id = r.json()["id"]
    assert r.json()["skill"] == "調理師免許"

    # スキル一覧取得
    r = client.get(f"/api/staff/{staff_id}/skills")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["skill"] == "調理師免許"

    # スキル削除
    r = client.delete(f"/api/staff/{staff_id}/skills/{skill_id}")
    assert r.status_code == 204

    # 削除後は空
    r = client.get(f"/api/staff/{staff_id}/skills")
    assert r.status_code == 200
    assert r.json() == []


def test_skill_requirements_crud(client):
    """スキル要件の CRUD テスト"""
    # シフト枠を作成
    r = client.post("/api/shift-slots", json={"name": "早番", "start_time": "09:00:00", "end_time": "17:00:00"})
    assert r.status_code == 201
    slot_id = r.json()["id"]

    # スキル要件追加
    r = client.post("/api/skill-requirements", json={
        "shift_slot_id": slot_id,
        "day_type": "weekday",
        "skill": "調理師免許",
        "min_count": 1,
    })
    assert r.status_code == 201
    req_id = r.json()["id"]
    assert r.json()["skill"] == "調理師免許"
    assert r.json()["min_count"] == 1

    # 一覧取得
    r = client.get("/api/skill-requirements")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # 削除
    r = client.delete(f"/api/skill-requirements/{req_id}")
    assert r.status_code == 204

    # 削除後は空
    r = client.get("/api/skill-requirements")
    assert r.status_code == 200
    assert r.json() == []


def test_staff_skill_not_found(client):
    """存在しないスタッフへのスキル追加は 404"""
    r = client.post("/api/staff/999/skills", json={"skill": "調理師免許"})
    assert r.status_code == 404
