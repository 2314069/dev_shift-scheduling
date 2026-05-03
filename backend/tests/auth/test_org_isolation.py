"""組織間のデータ分離テスト"""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.auth import get_current_user
from backend.database import Base, get_db
from backend.main import app
from backend.models import Organization, OrganizationMember, StaffModel, User


@pytest.fixture
def isolation_client():
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

    with Session() as db:
        # 2組織を作成
        org_a = Organization(id=org_a_id, name="Org A", slug="org-a")
        org_b = Organization(id=org_b_id, name="Org B", slug="org-b")
        db.add_all([org_a, org_b])

        # 各組織のユーザーを作成
        user_a = User(id=user_a_id, email="admin_a@example.com")
        user_b = User(id=user_b_id, email="admin_b@example.com")
        db.add_all([user_a, user_b])

        # OrganizationMember を作成
        member_a = OrganizationMember(organization_id=org_a_id, user_id=user_a_id, role="owner")
        member_b = OrganizationMember(organization_id=org_b_id, user_id=user_b_id, role="owner")
        db.add_all([member_a, member_b])

        # 各組織にスタッフを作成
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
        db.commit()
        db.refresh(staff_a)
        db.refresh(staff_b)

        staff_a_id = staff_a.id
        staff_b_id = staff_b.id

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    # org_a のユーザーとして get_current_user をオーバーライド
    def override_get_current_user_a():
        with Session() as db:
            return db.query(User).filter(User.id == user_a_id).first()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user_a

    client = TestClient(app)
    yield client, staff_a_id, staff_b_id
    app.dependency_overrides.clear()


def test_listing_staff_only_returns_own_org(isolation_client):
    """組織 A のユーザーでリストを取得すると、組織 A のスタッフのみ返ること。"""
    client, staff_a_id, staff_b_id = isolation_client
    resp = client.get("/api/staff")
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    assert staff_a_id in ids
    assert staff_b_id not in ids


def test_other_org_staff_returns_404(isolation_client):
    """組織 A のユーザーが組織 B のスタッフを更新しようとすると 404 が返ること。"""
    client, staff_a_id, staff_b_id = isolation_client
    resp = client.put(
        f"/api/staff/{staff_b_id}",
        json={"name": "Hacked", "role": "admin", "max_days_per_week": 5, "min_days_per_week": 0},
    )
    assert resp.status_code == 404
