"""Phase 1-1 オンボーディング テナント分離テスト。

オンボーディング API（POST /api/organizations, GET /api/me）を対象に、
テナント（組織）をまたいだ不正アクセスを検証する。

テストシナリオ:
  1. クロステナント侵入: User A の認証で GET /api/staff を叩いても User B の
     組織のスタッフが見えないこと
  2. 自分が所属しない組織を current にできない: GET /api/me で返る
     current_organization が、他ユーザー所有の組織にならないこと
  3. POST /api/organizations の認可: 認証ユーザーが確実に組織所有者になること
     (他ユーザーへのなりすまし不可)
  4. User A が owner のとき、User B の組織スタッフにはアクセスできないこと
     (既存 test_org_isolation との統合確認)
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.auth import get_current_user
from backend.database import Base, get_db
from backend.main import app
from backend.models import Organization, OrganizationMember, StaffModel, User

# ---------------------------------------------------------------------------
# ヘルパー（test_onboarding_flow.py と同一パターン）
# ---------------------------------------------------------------------------


def _make_stub_user(user_id: str, email: str = "test@example.com") -> User:
    """テスト用スタブユーザー。MagicMock で DB アクセスを回避する。

    UserResponse は created_at / updated_at を非 null datetime として要求するため、
    stub にも実 datetime を設定する。
    """
    now = datetime.now(timezone.utc)
    user = MagicMock(spec=User)
    user.id = user_id
    user.email = email
    user.name = "テストユーザー"
    user.image = None
    user.email_verified_at = None
    user.created_at = now
    user.updated_at = now
    user.deleted_at = None
    return user


def _make_client_for_user(
    db_session, user_id: str, email: str = "test@example.com"
) -> TestClient:
    """指定ユーザーとして認証されたクライアントを返す。

    get_current_user をスタブに差し替える。get_current_org_id はオーバーライドせず、
    DB の OrganizationMember を参照する実際の挙動を使う。
    """

    def override_get_db():
        yield db_session

    stub_user = _make_stub_user(user_id=user_id, email=email)

    def override_get_current_user():
        return stub_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


# ---------------------------------------------------------------------------
# フィクスチャ: 2 ユーザー + 2 組織の環境
# ---------------------------------------------------------------------------


@pytest.fixture
def two_tenant_env():
    """User A が Org A を所有し、User B が Org B を所有する環境を構築する。

    各組織にスタッフを 1 人ずつ登録した状態で返す。
    テスト後は dependency_overrides をクリアする。
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    user_a_id = str(uuid.uuid4())
    user_b_id = str(uuid.uuid4())
    org_a_id = str(uuid.uuid4())
    org_b_id = str(uuid.uuid4())

    with Session() as db:
        # ユーザー作成
        user_a = User(id=user_a_id, email="user_a@example.com")
        user_b = User(id=user_b_id, email="user_b@example.com")
        db.add_all([user_a, user_b])

        # 組織作成
        org_a = Organization(id=org_a_id, name="Org A 食堂", slug="org-a-shokudo")
        org_b = Organization(id=org_b_id, name="Org B 食堂", slug="org-b-shokudo")
        db.add_all([org_a, org_b])

        # メンバーシップ: A → Org A, B → Org B (owner)
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

        # スタッフ: Org A に 1 人、Org B に 1 人
        staff_a = StaffModel(
            organization_id=org_a_id,
            name="スタッフ A 太郎",
            role="staff",
            max_days_per_week=5,
            min_days_per_week=0,
        )
        staff_b = StaffModel(
            organization_id=org_b_id,
            name="スタッフ B 花子",
            role="staff",
            max_days_per_week=5,
            min_days_per_week=0,
        )
        db.add_all([staff_a, staff_b])
        db.commit()
        db.refresh(staff_a)
        db.refresh(staff_b)

    env = {
        "user_a_id": user_a_id,
        "user_b_id": user_b_id,
        "org_a_id": org_a_id,
        "org_b_id": org_b_id,
        "staff_a_id": staff_a.id,
        "staff_b_id": staff_b.id,
        "Session": Session,
    }
    yield env
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# シナリオ 1: クロステナント侵入 — GET /api/staff は自組織のみ返すこと
# ---------------------------------------------------------------------------


class TestCrossTenantStaffAccess:
    """User A の認証で GET /api/staff を叩いても Org B のスタッフが見えないこと。"""

    def test_user_a_only_sees_org_a_staff(self, two_tenant_env):
        """User A が GET /api/staff を叩くと Org A のスタッフのみ返る。"""
        env = two_tenant_env
        Session = env["Session"]

        def override_get_db():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        stub_a = _make_stub_user(user_id=env["user_a_id"], email="user_a@example.com")

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: stub_a
        client = TestClient(app)

        resp = client.get("/api/staff")
        assert resp.status_code == 200
        returned_ids = [s["id"] for s in resp.json()]

        # Org A のスタッフは見える
        assert env["staff_a_id"] in returned_ids
        # Org B のスタッフは見えない（クロステナント越境禁止）
        assert env["staff_b_id"] not in returned_ids

    def test_user_b_only_sees_org_b_staff(self, two_tenant_env):
        """User B が GET /api/staff を叩くと Org B のスタッフのみ返る。"""
        env = two_tenant_env
        Session = env["Session"]

        def override_get_db():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        stub_b = _make_stub_user(user_id=env["user_b_id"], email="user_b@example.com")

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: stub_b
        client = TestClient(app)

        resp = client.get("/api/staff")
        assert resp.status_code == 200
        returned_ids = [s["id"] for s in resp.json()]

        assert env["staff_b_id"] in returned_ids
        assert env["staff_a_id"] not in returned_ids

    def test_user_a_cannot_read_org_b_staff_by_id(self, two_tenant_env):
        """User A が Org B のスタッフ ID を直接指定しても 404 が返ること。"""
        env = two_tenant_env
        Session = env["Session"]

        def override_get_db():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        stub_a = _make_stub_user(user_id=env["user_a_id"], email="user_a@example.com")

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: stub_a
        client = TestClient(app)

        # Org B のスタッフ ID に対して PUT（スタッフ詳細取得は PUT/PATCH 経由で確認）
        resp = client.put(
            f"/api/staff/{env['staff_b_id']}",
            json={
                "name": "不正書き換え",
                "role": "staff",
                "max_days_per_week": 5,
                "min_days_per_week": 0,
            },
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# シナリオ 2: GET /api/me の current_organization が他テナントにならないこと
# ---------------------------------------------------------------------------


class TestCurrentOrganizationIsolation:
    """GET /api/me で返る current_organization が、ユーザー自身の組織のみであること。"""

    def test_user_a_me_returns_org_a_as_current(self, two_tenant_env):
        """User A の GET /api/me で current_organization が Org A であること。"""
        env = two_tenant_env
        Session = env["Session"]

        def override_get_db():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        stub_a = _make_stub_user(user_id=env["user_a_id"], email="user_a@example.com")

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: stub_a
        client = TestClient(app)

        resp = client.get("/api/me")
        assert resp.status_code == 200
        data = resp.json()

        assert data["current_organization"] is not None
        # Org A が current_organization に返ること
        assert data["current_organization"]["id"] == env["org_a_id"]
        # Org B は current_organization に返らないこと
        assert data["current_organization"]["id"] != env["org_b_id"]

    def test_user_b_me_returns_org_b_as_current(self, two_tenant_env):
        """User B の GET /api/me で current_organization が Org B であること。"""
        env = two_tenant_env
        Session = env["Session"]

        def override_get_db():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        stub_b = _make_stub_user(user_id=env["user_b_id"], email="user_b@example.com")

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: stub_b
        client = TestClient(app)

        resp = client.get("/api/me")
        assert resp.status_code == 200
        data = resp.json()

        assert data["current_organization"] is not None
        assert data["current_organization"]["id"] == env["org_b_id"]
        assert data["current_organization"]["id"] != env["org_a_id"]

    def test_user_a_me_organizations_does_not_include_org_b(self, two_tenant_env):
        """User A の GET /api/me で organizations リストに Org B が含まれないこと。"""
        env = two_tenant_env
        Session = env["Session"]

        def override_get_db():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        stub_a = _make_stub_user(user_id=env["user_a_id"], email="user_a@example.com")

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: stub_a
        client = TestClient(app)

        resp = client.get("/api/me")
        assert resp.status_code == 200
        data = resp.json()

        org_ids_in_list = [m["organization"]["id"] for m in data["organizations"]]
        assert env["org_a_id"] in org_ids_in_list
        assert env["org_b_id"] not in org_ids_in_list


# ---------------------------------------------------------------------------
# シナリオ 3: POST /api/organizations の認可
# ---------------------------------------------------------------------------


class TestPostOrganizationsAuthorization:
    """POST /api/organizations: 認証ユーザーが確実に組織所有者になること。"""

    def test_authenticated_user_becomes_owner_of_new_org(self, two_tenant_env):
        """POST /api/organizations を叩くと、呼び出しユーザーが owner Member になること。"""
        env = two_tenant_env
        Session = env["Session"]

        # 新規ユーザー (User C) を作成: 組織未所属
        user_c_id = str(uuid.uuid4())
        with Session() as db:
            user_c = User(id=user_c_id, email="user_c@example.com")
            db.add(user_c)
            db.commit()

        def override_get_db():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        stub_c = _make_stub_user(user_id=user_c_id, email="user_c@example.com")

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: stub_c
        client = TestClient(app)

        resp = client.post("/api/organizations", json={"name": "User C の店"})
        assert resp.status_code == 201
        new_org_id = resp.json()["id"]

        # DB で User C が owner になっていることを確認
        with Session() as db:
            member = (
                db.query(OrganizationMember)
                .filter(
                    OrganizationMember.organization_id == new_org_id,
                    OrganizationMember.user_id == user_c_id,
                    OrganizationMember.role == "owner",
                )
                .first()
            )
            assert member is not None, "User C が owner Member として登録されていない"

    def test_owner_user_cannot_create_second_organization(self, two_tenant_env):
        """既に owner 組織を持つ User A が POST /api/organizations を叩くと 409。"""
        env = two_tenant_env
        Session = env["Session"]

        def override_get_db():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        stub_a = _make_stub_user(user_id=env["user_a_id"], email="user_a@example.com")

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: stub_a
        client = TestClient(app)

        # User A はすでに Org A の owner なので、2 つ目の組織作成は 409
        resp = client.post("/api/organizations", json={"name": "User A の 2 つ目の店"})
        assert resp.status_code == 409
        assert "already own" in resp.json()["detail"].lower()

    def test_only_authenticated_user_becomes_org_owner_not_another_user(
        self, two_tenant_env
    ):
        """POST /api/organizations の呼び出しユーザーのみが owner になり、他ユーザーは owner にならない。

        設計上、組織作成エンドポイントは get_current_user で認証ユーザーを特定し、
        そのユーザーを owner として登録する。他ユーザーを owner にする口は存在しない。
        このテストでは User C が新組織を作成した後、User A が owner でないことを確認する。
        """
        env = two_tenant_env
        Session = env["Session"]

        # 新規ユーザー (User C) を作成
        user_c_id = str(uuid.uuid4())
        with Session() as db:
            user_c = User(id=user_c_id, email="user_c2@example.com")
            db.add(user_c)
            db.commit()

        def override_get_db():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        # User C として認証して組織を作成
        stub_c = _make_stub_user(user_id=user_c_id, email="user_c2@example.com")

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: stub_c
        client = TestClient(app)

        resp = client.post("/api/organizations", json={"name": "User C の新店舗"})
        assert resp.status_code == 201
        new_org_id = resp.json()["id"]

        # User A (env["user_a_id"]) がこの新組織の owner に
        # なっていないことを確認（なりすまし不可）
        with Session() as db:
            user_a_as_owner = (
                db.query(OrganizationMember)
                .filter(
                    OrganizationMember.organization_id == new_org_id,
                    OrganizationMember.user_id == env["user_a_id"],
                    OrganizationMember.role == "owner",
                )
                .first()
            )
            assert user_a_as_owner is None, (
                "User A が User C の組織の owner になっている（なりすまし発生）"
            )

    def test_new_org_not_visible_to_other_user_via_me(self, two_tenant_env):
        """User C が作成した組織は、User A の GET /api/me では見えないこと。"""
        env = two_tenant_env
        Session = env["Session"]

        # User C を作成
        user_c_id = str(uuid.uuid4())
        with Session() as db:
            user_c = User(id=user_c_id, email="user_c3@example.com")
            db.add(user_c)
            db.commit()

        def override_get_db():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db

        # User C が組織を作成
        stub_c = _make_stub_user(user_id=user_c_id, email="user_c3@example.com")
        app.dependency_overrides[get_current_user] = lambda: stub_c
        client_c = TestClient(app)
        resp = client_c.post("/api/organizations", json={"name": "User C の見えない店"})
        assert resp.status_code == 201
        new_org_id = resp.json()["id"]

        # User A の GET /api/me で新組織が見えないことを確認
        stub_a = _make_stub_user(user_id=env["user_a_id"], email="user_a@example.com")
        app.dependency_overrides[get_current_user] = lambda: stub_a
        client_a = TestClient(app)
        resp_me = client_a.get("/api/me")
        assert resp_me.status_code == 200
        data = resp_me.json()

        org_ids_in_list = [m["organization"]["id"] for m in data["organizations"]]
        assert new_org_id not in org_ids_in_list, (
            "User C の組織が User A の /api/me に表示されている（クロステナント漏洩）"
        )

    def test_deleted_org_not_shown_in_me(self, two_tenant_env):
        """論理削除された組織は GET /api/me の organizations に含まれないこと。"""
        from datetime import datetime, timezone

        env = two_tenant_env
        Session = env["Session"]

        # Org A を論理削除する
        with Session() as db:
            org_a = (
                db.query(Organization)
                .filter(Organization.id == env["org_a_id"])
                .first()
            )
            org_a.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()

        def override_get_db():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        stub_a = _make_stub_user(user_id=env["user_a_id"], email="user_a@example.com")

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: stub_a
        client = TestClient(app)

        resp = client.get("/api/me")
        assert resp.status_code == 200
        data = resp.json()

        # 論理削除された Org A は organizations に現れない
        org_ids = [m["organization"]["id"] for m in data["organizations"]]
        assert env["org_a_id"] not in org_ids
        # current_organization も None になること
        assert data["current_organization"] is None
