"""組織間のデータ分離テスト"""

import uuid
from datetime import date, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.auth import get_current_user
from backend.database import Base, get_db
from backend.main import app
from backend.models import (
    Organization,
    OrganizationMember,
    ScheduleAssignmentModel,
    SchedulePeriodModel,
    ShiftSlotModel,
    StaffModel,
    User,
)


@pytest.fixture
def isolation_client():
    """組織 A / 組織 B にそれぞれ最小限の業務データを持つ環境。

    組織 A のユーザーとして認証済み（get_current_user は org_a の User を返す）。
    `slot_b_id` / `staff_b_id` / `period_b_id` / `assignment_b_id` などを使うと
    クロステナント越境を試行するテストが書ける。
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    org_a_id = str(uuid.uuid4())
    org_b_id = str(uuid.uuid4())
    user_a_id = str(uuid.uuid4())
    user_b_id = str(uuid.uuid4())

    ids: dict[str, int | str] = {"org_a_id": org_a_id, "org_b_id": org_b_id}

    with Session() as db:
        org_a = Organization(id=org_a_id, name="Org A", slug="org-a")
        org_b = Organization(id=org_b_id, name="Org B", slug="org-b")
        db.add_all([org_a, org_b])

        user_a = User(id=user_a_id, email="admin_a@example.com")
        user_b = User(id=user_b_id, email="admin_b@example.com")
        db.add_all([user_a, user_b])

        db.add_all(
            [
                OrganizationMember(
                    organization_id=org_a_id, user_id=user_a_id, role="owner"
                ),
                OrganizationMember(
                    organization_id=org_b_id, user_id=user_b_id, role="owner"
                ),
            ]
        )

        # スタッフ
        staff_a = StaffModel(
            organization_id=org_a_id,
            name="Staff A",
            role="staff",
            max_days_per_week=5,
            min_days_per_week=0,
        )
        staff_b = StaffModel(
            organization_id=org_b_id,
            name="Staff B",
            role="staff",
            max_days_per_week=5,
            min_days_per_week=0,
        )
        db.add_all([staff_a, staff_b])

        # シフト枠
        slot_a = ShiftSlotModel(
            organization_id=org_a_id,
            name="Slot A",
            start_time=time(9, 0),
            end_time=time(17, 0),
        )
        slot_b = ShiftSlotModel(
            organization_id=org_b_id,
            name="Slot B",
            start_time=time(9, 0),
            end_time=time(17, 0),
        )
        db.add_all([slot_a, slot_b])

        # スケジュール期間
        period_a = SchedulePeriodModel(
            organization_id=org_a_id,
            start_date=date(2026, 5, 1),
            end_date=date(2026, 5, 31),
            status="draft",
        )
        period_b = SchedulePeriodModel(
            organization_id=org_b_id,
            start_date=date(2026, 5, 1),
            end_date=date(2026, 5, 31),
            status="draft",
        )
        db.add_all([period_a, period_b])
        db.commit()
        db.refresh(staff_a)
        db.refresh(staff_b)
        db.refresh(slot_a)
        db.refresh(slot_b)
        db.refresh(period_a)
        db.refresh(period_b)

        # 各組織にアサインメントを作成（越境 PUT・越境 slot 上書きのターゲット）
        assignment_a = ScheduleAssignmentModel(
            organization_id=org_a_id,
            period_id=period_a.id,
            staff_id=staff_a.id,
            date=date(2026, 5, 1),
            shift_slot_id=slot_a.id,
            is_manual_edit=False,
        )
        assignment_b = ScheduleAssignmentModel(
            organization_id=org_b_id,
            period_id=period_b.id,
            staff_id=staff_b.id,
            date=date(2026, 5, 1),
            shift_slot_id=slot_b.id,
            is_manual_edit=False,
        )
        db.add_all([assignment_a, assignment_b])

        # 組織未所属の rogue user（403 テスト用）
        rogue_user_id = str(uuid.uuid4())
        db.add(User(id=rogue_user_id, email="rogue@example.com"))

        db.commit()
        db.refresh(assignment_a)
        db.refresh(assignment_b)

        ids.update(
            {
                "user_a_id": user_a_id,
                "rogue_user_id": rogue_user_id,
                "staff_a_id": staff_a.id,
                "staff_b_id": staff_b.id,
                "slot_a_id": slot_a.id,
                "slot_b_id": slot_b.id,
                "period_a_id": period_a.id,
                "period_b_id": period_b.id,
                "assignment_a_id": assignment_a.id,
                "assignment_b_id": assignment_b.id,
            }
        )

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    def override_get_current_user_a():
        with Session() as db:
            return db.query(User).filter(User.id == user_a_id).first()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user_a

    client = TestClient(app)
    yield client, ids
    app.dependency_overrides.clear()


# --- 既存の基本ケース ---


def test_listing_staff_only_returns_own_org(isolation_client):
    """組織 A のユーザーでリストを取得すると、組織 A のスタッフのみ返ること。"""
    client, ids = isolation_client
    resp = client.get("/api/staff")
    assert resp.status_code == 200
    returned_ids = [s["id"] for s in resp.json()]
    assert ids["staff_a_id"] in returned_ids
    assert ids["staff_b_id"] not in returned_ids


def test_other_org_staff_returns_404(isolation_client):
    """組織 A のユーザーが組織 B のスタッフを更新しようとすると 404 が返ること。"""
    client, ids = isolation_client
    resp = client.put(
        f"/api/staff/{ids['staff_b_id']}",
        json={
            "name": "Hacked",
            "role": "admin",
            "max_days_per_week": 5,
            "min_days_per_week": 0,
        },
    )
    assert resp.status_code == 404


# --- 追加: DELETE 越境 ---


def test_delete_other_org_staff_returns_404(isolation_client):
    """組織 A のユーザーが組織 B のスタッフを削除しようとすると 404 が返ること。"""
    client, ids = isolation_client
    resp = client.delete(f"/api/staff/{ids['staff_b_id']}")
    assert resp.status_code == 404


def test_delete_other_org_shift_slot_returns_404(isolation_client):
    """組織 A のユーザーが組織 B のシフト枠を削除しようとすると 404 が返ること。"""
    client, ids = isolation_client
    resp = client.delete(f"/api/shift-slots/{ids['slot_b_id']}")
    assert resp.status_code == 404


# --- 追加: FK クロステナント参照書き込み ---


def test_create_staffing_requirement_with_other_org_slot_returns_404(isolation_client):
    """組織 B の shift_slot_id を渡すと 404 が返り、データは保存されないこと。"""
    client, ids = isolation_client
    resp = client.post(
        "/api/staffing-requirements",
        json={"shift_slot_id": ids["slot_b_id"], "day_type": "weekday", "min_count": 1},
    )
    assert resp.status_code == 404
    # 自組織のリストは空のままであることを確認
    list_resp = client.get("/api/staffing-requirements")
    assert list_resp.status_code == 200
    assert list_resp.json() == []


def test_create_role_staffing_with_other_org_slot_returns_404(isolation_client):
    client, ids = isolation_client
    resp = client.post(
        "/api/role-staffing-requirements",
        json={
            "shift_slot_id": ids["slot_b_id"],
            "day_type": "weekday",
            "role": "staff",
            "min_count": 1,
        },
    )
    assert resp.status_code == 404


def test_create_skill_requirement_with_other_org_slot_returns_404(isolation_client):
    client, ids = isolation_client
    resp = client.post(
        "/api/skill-requirements",
        json={
            "shift_slot_id": ids["slot_b_id"],
            "day_type": "weekday",
            "skill": "first-aid",
            "min_count": 1,
        },
    )
    assert resp.status_code == 404


def test_bulk_create_requests_with_other_org_staff_returns_404(isolation_client):
    """組織 B の staff_id を含むリクエストは 404、organization_id 越境保存も発生しないこと。"""
    client, ids = isolation_client
    resp = client.post(
        "/api/requests",
        json={
            "period_id": ids["period_a_id"],
            "requests": [
                {
                    "staff_id": ids["staff_b_id"],
                    "date": "2026-05-01",
                    "type": "preferred",
                }
            ],
        },
    )
    assert resp.status_code == 404


def test_bulk_create_requests_with_other_org_slot_returns_404(isolation_client):
    """組織 B の shift_slot_id を含むリクエストは 404 が返ること。"""
    client, ids = isolation_client
    resp = client.post(
        "/api/requests",
        json={
            "period_id": ids["period_a_id"],
            "requests": [
                {
                    "staff_id": ids["staff_a_id"],
                    "date": "2026-05-01",
                    "shift_slot_id": ids["slot_b_id"],
                    "type": "preferred",
                }
            ],
        },
    )
    assert resp.status_code == 404


def test_bulk_create_requests_with_out_of_period_date_returns_404(isolation_client):
    """period_id の範囲外の date は 404 が返ること（M4 の検証）。"""
    client, ids = isolation_client
    resp = client.post(
        "/api/requests",
        json={
            "period_id": ids["period_a_id"],
            "requests": [
                {
                    "staff_id": ids["staff_a_id"],
                    "date": "2026-06-15",  # 範囲外
                    "type": "preferred",
                }
            ],
        },
    )
    assert resp.status_code == 404


def test_bulk_create_requests_with_other_org_period_returns_404(isolation_client):
    """組織 B の period_id を指定しても 404 になること（M4 の検証）。"""
    client, ids = isolation_client
    resp = client.post(
        "/api/requests",
        json={
            "period_id": ids["period_b_id"],
            "requests": [
                {
                    "staff_id": ids["staff_a_id"],
                    "date": "2026-05-01",
                    "type": "preferred",
                }
            ],
        },
    )
    assert resp.status_code == 404


# --- 追加: 他組織 schedule 越境 ---


def test_get_other_org_schedule_returns_404(isolation_client):
    client, ids = isolation_client
    resp = client.get(f"/api/schedules/{ids['period_b_id']}")
    assert resp.status_code == 404


def test_update_other_org_assignment_returns_404(isolation_client):
    """組織 B の assignment_id を指定しても 404 が返ること。"""
    client, ids = isolation_client
    resp = client.put(
        f"/api/schedules/{ids['period_b_id']}/assignments/{ids['assignment_b_id']}",
        json={"shift_slot_id": ids["slot_a_id"]},
    )
    assert resp.status_code == 404


def test_update_assignment_to_other_org_slot_returns_404(isolation_client):
    """組織 A のアサインメントの shift_slot_id を組織 B の slot に変更すると 404。"""
    client, ids = isolation_client
    resp = client.put(
        f"/api/schedules/{ids['period_a_id']}/assignments/{ids['assignment_a_id']}",
        json={"shift_slot_id": ids["slot_b_id"]},
    )
    assert resp.status_code == 404
    # アサインメントが他組織 slot で書き換えられていないことを確認
    schedule_resp = client.get(f"/api/schedules/{ids['period_a_id']}")
    assert schedule_resp.status_code == 200
    assignments = schedule_resp.json()["assignments"]
    assignment_a = next(a for a in assignments if a["id"] == ids["assignment_a_id"])
    assert assignment_a["shift_slot_id"] == ids["slot_a_id"]


# --- 追加: 組織未所属ユーザー → 403 ---


def test_user_without_membership_returns_403(isolation_client):
    """OrganizationMember を持たないユーザーが API を叩くと 403 が返ること。"""
    client, ids = isolation_client
    rogue_user_id = ids["rogue_user_id"]

    # 既存 override_get_db のジェネレータから db を取り出して User を query する
    def override_rogue():
        gen = app.dependency_overrides[get_db]()
        db = next(gen)
        try:
            return db.query(User).filter(User.id == rogue_user_id).first()
        finally:
            gen.close()

    app.dependency_overrides[get_current_user] = override_rogue
    resp = client.get("/api/staff")
    assert resp.status_code == 403
