"""Phase 1-1 オンボーディング フロー統合テスト。

バックエンドの全エンドポイントを組み合わせ、新規ユーザーが
店舗を作成してスタッフを登録するまでの一連のフローを検証する。

テスト対象シナリオ:
  1. 新規ユーザーフルフロー: GET /api/me → POST /api/organizations → GET /api/me → GET /api/staff → スタッフ作成 → GET /api/me
  2. 組織未所属ユーザーが業務 API を叩くと 403
  3. 同一ユーザーが複数組織を作成しようとすると 2 件目で 409
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
# フィクスチャ
# ---------------------------------------------------------------------------


@pytest.fixture
def db_engine():
    """インメモリ SQLite エンジン（各テストで独立した DB）。"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


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


def _make_unauth_client(db_session, monkeypatch) -> TestClient:
    """認証なしクライアント。AUTH_SECRET を設定して 401 が返るようにする。"""
    monkeypatch.setenv("AUTH_SECRET", "test-secret-for-401-check")

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


# ---------------------------------------------------------------------------
# シナリオ 1: 新規ユーザーフルフロー
# ---------------------------------------------------------------------------


class TestNewUserFullFlow:
    """新規ユーザーが店舗を作成し、スタッフを登録するまでの一連のフロー。"""

    def test_get_me_before_org_creation(self, db_session):
        """組織作成前: organizations: [], current_organization: null, onboarding: null"""
        user_id = str(uuid.uuid4())
        # DB にユーザーを実際に作成（MagicMock は DB に存在しないため me API の JOIN を通る）
        user = User(id=user_id, email="newuser@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(
            db_session, user_id=user_id, email="newuser@example.com"
        )
        try:
            resp = client.get("/api/me")
            assert resp.status_code == 200

            data = resp.json()
            assert data["organizations"] == []
            assert data["current_organization"] is None
            assert data["onboarding"] is None
        finally:
            app.dependency_overrides.clear()

    def test_create_organization_success(self, db_session):
        """POST /api/organizations で 201 が返り、組織と owner メンバーが作成される。"""
        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="newuser2@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            resp = client.post(
                "/api/organizations",
                json={"name": "テスト食堂"},
            )
            assert resp.status_code == 201

            data = resp.json()
            assert data["name"] == "テスト食堂"
            assert "id" in data
            assert "slug" in data

            # DB に OrganizationMember(role=owner) が作成されていること
            member = (
                db_session.query(OrganizationMember)
                .filter(
                    OrganizationMember.organization_id == data["id"],
                    OrganizationMember.user_id == user_id,
                )
                .first()
            )
            assert member is not None
            assert member.role == "owner"
        finally:
            app.dependency_overrides.clear()

    def test_get_me_after_org_creation(self, db_session):
        """組織作成後: organizations: [{...}], current_organization: {...}, onboarding.has_organization: true"""
        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="newuser3@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            # 組織を作成
            create_resp = client.post(
                "/api/organizations",
                json={"name": "フルフロー食堂"},
            )
            assert create_resp.status_code == 201
            org_id = create_resp.json()["id"]

            # /api/me で組織所属を確認
            me_resp = client.get("/api/me")
            assert me_resp.status_code == 200

            data = me_resp.json()
            assert len(data["organizations"]) == 1
            assert data["current_organization"] is not None
            assert data["current_organization"]["id"] == org_id
            assert data["onboarding"] is not None
            assert data["onboarding"]["staff_count"] == 0
            assert data["onboarding"]["shift_slot_count"] == 0
            assert data["onboarding"]["is_complete"] is False
        finally:
            app.dependency_overrides.clear()

    def test_get_staff_returns_empty_after_org_creation(self, db_session):
        """組織作成直後: GET /api/staff で 200 かつ空配列が返ること。"""
        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="newuser4@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            # 組織を作成
            create_resp = client.post(
                "/api/organizations",
                json={"name": "スタッフゼロ食堂"},
            )
            assert create_resp.status_code == 201

            # スタッフ一覧が空であること
            staff_resp = client.get("/api/staff")
            assert staff_resp.status_code == 200
            assert staff_resp.json() == []
        finally:
            app.dependency_overrides.clear()

    def test_onboarding_staff_count_updates_after_staff_creation(self, db_session):
        """スタッフを 1 人登録後: GET /api/me で onboarding.staff_count: 1"""
        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="newuser5@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            # 組織を作成
            create_resp = client.post(
                "/api/organizations",
                json={"name": "スタッフ追加食堂"},
            )
            assert create_resp.status_code == 201

            # スタッフを 1 人登録
            staff_resp = client.post(
                "/api/staff",
                json={
                    "name": "山田太郎",
                    "role": "staff",
                    "max_days_per_week": 5,
                    "min_days_per_week": 0,
                },
            )
            assert staff_resp.status_code == 201

            # /api/me で onboarding.staff_count が 1 になっていること
            me_resp = client.get("/api/me")
            assert me_resp.status_code == 200

            data = me_resp.json()
            assert data["onboarding"]["staff_count"] == 1
        finally:
            app.dependency_overrides.clear()

    def test_full_flow_sequential(self, db_session):
        """フルフローを一本で: 組織なし → 作成 → スタッフ登録 → onboarding 更新確認。"""
        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="fullflow@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            # Step 1: 組織なし確認
            me = client.get("/api/me").json()
            assert me["organizations"] == []
            assert me["onboarding"] is None

            # Step 2: 組織作成
            resp = client.post("/api/organizations", json={"name": "総合テスト食堂"})
            assert resp.status_code == 201

            # Step 3: 組織所属確認
            me = client.get("/api/me").json()
            assert len(me["organizations"]) == 1
            assert me["onboarding"]["staff_count"] == 0

            # Step 4: スタッフ登録
            client.post(
                "/api/staff",
                json={
                    "name": "テスト太郎",
                    "role": "staff",
                    "max_days_per_week": 5,
                    "min_days_per_week": 0,
                },
            )

            # Step 5: onboarding.staff_count 更新確認
            me = client.get("/api/me").json()
            assert me["onboarding"]["staff_count"] == 1
        finally:
            app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# シナリオ 2: 組織未所属ユーザーが業務 API を叩くと 403
# ---------------------------------------------------------------------------


class TestNoMembershipReturns403:
    """組織未所属ユーザーが業務 API（get_current_org_id に依存する API）を叩くと 403。"""

    def test_get_staff_without_membership_returns_403(self, db_session):
        """組織未所属のユーザーが GET /api/staff を叩くと 403。"""
        user_id = str(uuid.uuid4())
        # DB にユーザーを作成するが OrganizationMember は作成しない
        user = User(id=user_id, email="nomember@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            resp = client.get("/api/staff")
            assert resp.status_code == 403
        finally:
            app.dependency_overrides.clear()

    def test_get_shift_slots_without_membership_returns_403(self, db_session):
        """組織未所属のユーザーが GET /api/shift-slots を叩くと 403。"""
        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="nomember2@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            resp = client.get("/api/shift-slots")
            assert resp.status_code == 403
        finally:
            app.dependency_overrides.clear()

    def test_get_schedules_without_membership_returns_403(self, db_session):
        """組織未所属のユーザーが GET /api/schedules を叩くと 403。"""
        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="nomember3@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            resp = client.get("/api/schedules")
            assert resp.status_code == 403
        finally:
            app.dependency_overrides.clear()

    def test_get_me_without_membership_returns_200_with_empty_orgs(self, db_session):
        """組織未所属でも GET /api/me は 200 で organizations: [] を返すこと。

        /api/me は get_current_org_id に依存しないため、組織未所属でも正常に呼べる。
        """
        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="nomember4@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            resp = client.get("/api/me")
            assert resp.status_code == 200
            data = resp.json()
            assert data["organizations"] == []
            assert data["current_organization"] is None
        finally:
            app.dependency_overrides.clear()

    def test_post_organizations_without_membership_succeeds(self, db_session):
        """組織未所属でも POST /api/organizations は 201 で作成できること（組織作成 API の前提）。"""
        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="nomember5@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            resp = client.post(
                "/api/organizations",
                json={"name": "初めての店"},
            )
            assert resp.status_code == 201
        finally:
            app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# シナリオ 3: 同一ユーザーが複数組織を作成しようとすると 2 件目で 409
# ---------------------------------------------------------------------------


class TestDuplicateOrganizationCreation:
    """同一ユーザーが 2 つ目の owner 組織を作ろうとすると 409。"""

    def test_second_org_creation_returns_409(self, db_session):
        """1 件目は 201、2 件目は 409 が返ること。"""
        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="duporg@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            # 1 件目: 成功
            resp1 = client.post(
                "/api/organizations",
                json={"name": "最初の店"},
            )
            assert resp1.status_code == 201

            # 2 件目: 409
            resp2 = client.post(
                "/api/organizations",
                json={"name": "2 店目"},
            )
            assert resp2.status_code == 409
        finally:
            app.dependency_overrides.clear()

    def test_second_org_409_detail_contains_already_own(self, db_session):
        """409 のレスポンスボディに "already own" が含まれること。"""
        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="duporg2@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            client.post("/api/organizations", json={"name": "最初の店"})
            resp = client.post("/api/organizations", json={"name": "2 店目"})
            assert resp.status_code == 409
            assert "already own" in resp.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()

    def test_first_org_remains_after_409(self, db_session):
        """409 後も最初の組織はそのまま残ること（DB が壊れていないこと）。"""
        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="duporg3@example.com")
        db_session.add(user)
        db_session.commit()

        client = _make_client_for_user(db_session, user_id=user_id)
        try:
            resp1 = client.post("/api/organizations", json={"name": "元の店"})
            assert resp1.status_code == 201
            org_id = resp1.json()["id"]

            # 2 件目は失敗
            client.post("/api/organizations", json={"name": "2 店目"})

            # GET /api/me で最初の組織が残っていることを確認
            me_resp = client.get("/api/me")
            data = me_resp.json()
            assert len(data["organizations"]) == 1
            assert data["organizations"][0]["organization"]["id"] == org_id
        finally:
            app.dependency_overrides.clear()

    def test_different_users_can_each_create_org(self, db_session):
        """異なるユーザーはそれぞれ 1 つ組織を作成できること（同一制約は同一ユーザーのみ）。"""
        user_a_id = str(uuid.uuid4())
        user_b_id = str(uuid.uuid4())
        user_a = User(id=user_a_id, email="usera@example.com")
        user_b = User(id=user_b_id, email="userb@example.com")
        db_session.add(user_a)
        db_session.add(user_b)
        db_session.commit()

        # User A が組織を作成
        client_a = _make_client_for_user(db_session, user_id=user_a_id)
        try:
            resp_a = client_a.post("/api/organizations", json={"name": "A の店"})
            assert resp_a.status_code == 201
        finally:
            app.dependency_overrides.clear()

        # User B が組織を作成（A とは独立して成功するべき）
        client_b = _make_client_for_user(db_session, user_id=user_b_id)
        try:
            resp_b = client_b.post("/api/organizations", json={"name": "B の店"})
            assert resp_b.status_code == 201
        finally:
            app.dependency_overrides.clear()
