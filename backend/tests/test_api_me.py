"""GET /api/me の単体テスト。

conftest.py の client フィクスチャは get_current_user / get_current_org_id をスタブに
差し替えているため、そのまま使うと認証のテストができない。
認証なし (401) のテストは dependency_overrides を使わない専用の client を都度用意する。
"""

import os
import uuid
from datetime import datetime, time, timezone
from unittest.mock import MagicMock

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
    ShiftSlotModel,
    StaffModel,
    User,
)

# テスト用固定値
TEST_USER_ID = "me-test-user-uuid-0001"
TEST_ORG_ID = "me-test-org-uuid-0001"
TEST_ORG_SLUG = "me-test-org-slug"


# ---------------------------------------------------------------------------
# フィクスチャ
# ---------------------------------------------------------------------------


@pytest.fixture
def db_engine():
    """インメモリ SQLite エンジン（テストごとに独立した DB）。"""
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


def _make_stub_user(user_id: str = TEST_USER_ID) -> User:
    """テスト用スタブユーザー。

    SQLAlchemy の ORM instrumentation を回避するために MagicMock を使う。
    """
    user = MagicMock(spec=User)
    user.id = user_id
    user.email = "me-test@example.com"
    user.name = "ME テストユーザー"
    user.image = None
    user.email_verified_at = None
    user.created_at = datetime(2026, 5, 5, 9, 0, 0)
    user.updated_at = datetime(2026, 5, 5, 9, 0, 0)
    user.deleted_at = None
    return user


@pytest.fixture
def auth_client(db_session):
    """認証済みクライアント（get_current_user をスタブに差し替え）。

    get_current_org_id はオーバーライドしない（/api/me は依存しないため）。
    """

    def override_get_db():
        yield db_session

    stub_user = _make_stub_user()

    def override_get_current_user():
        return stub_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def unauth_client(db_session, monkeypatch):
    """認証なしクライアント（get_current_user は一切オーバーライドしない）。

    AUTH_SECRET を設定することで「秘密鍵未設定による 500」ではなく
    「トークンなしによる 401」が返るようにする。
    """
    monkeypatch.setenv("AUTH_SECRET", "test-secret-for-401-check")

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# テストヘルパー
# ---------------------------------------------------------------------------


def _create_org_and_member(
    db_session,
    user_id: str = TEST_USER_ID,
    org_id: str = TEST_ORG_ID,
    org_slug: str = TEST_ORG_SLUG,
    org_name: str = "テスト組織",
    role: str = "owner",
    deleted_at: datetime | None = None,
) -> tuple[Organization, OrganizationMember]:
    """テスト用の Organization と OrganizationMember を DB に作成して返す。"""
    # User が存在しなければ作成（MagicMock は DB に存在しないため）
    existing_user = db_session.query(User).filter(User.id == user_id).first()
    if existing_user is None:
        user = User(id=user_id, email="me-test@example.com")
        db_session.add(user)

    org = Organization(
        id=org_id,
        name=org_name,
        slug=org_slug,
        deleted_at=deleted_at,
    )
    db_session.add(org)

    member = OrganizationMember(
        organization_id=org_id,
        user_id=user_id,
        role=role,
    )
    db_session.add(member)
    db_session.commit()
    return org, member


def _create_staff(db_session, org_id: str, count: int = 1) -> list[StaffModel]:
    """テスト用のスタッフを指定件数 DB に作成して返す。"""
    staff_list = []
    for i in range(count):
        staff = StaffModel(
            organization_id=org_id,
            name=f"スタッフ {i + 1}",
            role="staff",
        )
        db_session.add(staff)
        staff_list.append(staff)
    db_session.commit()
    return staff_list


def _create_shift_slots(
    db_session, org_id: str, count: int = 1
) -> list[ShiftSlotModel]:
    """テスト用のシフト枠を指定件数 DB に作成して返す。"""
    slots = []
    for i in range(count):
        slot = ShiftSlotModel(
            organization_id=org_id,
            name=f"シフト枠 {i + 1}",
            start_time=time(9 + i, 0, 0),
            end_time=time(17 + i, 0, 0),
        )
        db_session.add(slot)
        slots.append(slot)
    db_session.commit()
    return slots


# ---------------------------------------------------------------------------
# GET /api/me テスト
# ---------------------------------------------------------------------------


class TestGetMeUnauthenticated:
    """認証なし → 401"""

    def test_returns_401_without_auth(self, unauth_client: TestClient) -> None:
        """認証なしで 401 が返ること。"""
        response = unauth_client.get("/api/me")
        assert response.status_code == 401

    def test_no_cache_control_header_on_401(self, unauth_client: TestClient) -> None:
        """401 でも Cache-Control ヘッダが含まれないこと（未認証は FastAPI 既定の 401 で返るため）。

        Note: get_current_user の 401 より前に Cache-Control は設定されない。
        FastAPI の Dependency エラーは response ミドルウェアを経由しないため。
        """
        response = unauth_client.get("/api/me")
        assert response.status_code == 401


class TestGetMeWithNoOrganization:
    """認証あり・組織なし → organizations: [], current_organization: null, onboarding: null"""

    def test_returns_200(self, auth_client: TestClient) -> None:
        """200 が返ること。"""
        response = auth_client.get("/api/me")
        assert response.status_code == 200

    def test_organizations_is_empty_list(self, auth_client: TestClient) -> None:
        """organizations が空配列であること。"""
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["organizations"] == []

    def test_current_organization_is_null(self, auth_client: TestClient) -> None:
        """current_organization が null であること。"""
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["current_organization"] is None

    def test_onboarding_is_null(self, auth_client: TestClient) -> None:
        """onboarding が null であること（組織がないため）。"""
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["onboarding"] is None

    def test_onboarding_has_organization_false(self, auth_client: TestClient) -> None:
        """organizations.length === 0 であること（フロント側で has_organization: false と判定できる）。"""
        response = auth_client.get("/api/me")
        data = response.json()
        assert len(data["organizations"]) == 0

    def test_user_fields_are_present(self, auth_client: TestClient) -> None:
        """user フィールドが存在し、email が含まれること。"""
        response = auth_client.get("/api/me")
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "me-test@example.com"

    def test_no_store_cache_control_header(self, auth_client: TestClient) -> None:
        """Cache-Control: no-store ヘッダが付与されること。"""
        response = auth_client.get("/api/me")
        assert response.status_code == 200
        assert response.headers.get("cache-control") == "no-store"


class TestGetMeWithOrganizationNoData:
    """認証あり・組織あり・初期データなし → onboarding.staff_count: 0, shift_slot_count: 0"""

    def test_returns_200(self, auth_client: TestClient, db_session) -> None:
        """200 が返ること。"""
        _create_org_and_member(db_session)
        response = auth_client.get("/api/me")
        assert response.status_code == 200

    def test_organizations_has_one_entry(
        self, auth_client: TestClient, db_session
    ) -> None:
        """organizations に 1 件含まれること。"""
        _create_org_and_member(db_session)
        response = auth_client.get("/api/me")
        data = response.json()
        assert len(data["organizations"]) == 1

    def test_current_organization_is_populated(
        self, auth_client: TestClient, db_session
    ) -> None:
        """current_organization が null でなく、id と name と role が含まれること。"""
        _create_org_and_member(db_session)
        response = auth_client.get("/api/me")
        data = response.json()
        current_org = data["current_organization"]
        assert current_org is not None
        assert current_org["id"] == TEST_ORG_ID
        assert current_org["name"] == "テスト組織"
        assert current_org["slug"] == TEST_ORG_SLUG
        assert current_org["role"] == "owner"

    def test_onboarding_staff_count_zero(
        self, auth_client: TestClient, db_session
    ) -> None:
        """onboarding.staff_count が 0 であること。"""
        _create_org_and_member(db_session)
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["onboarding"]["staff_count"] == 0

    def test_onboarding_shift_slot_count_zero(
        self, auth_client: TestClient, db_session
    ) -> None:
        """onboarding.shift_slot_count が 0 であること。"""
        _create_org_and_member(db_session)
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["onboarding"]["shift_slot_count"] == 0

    def test_onboarding_is_complete_false(
        self, auth_client: TestClient, db_session
    ) -> None:
        """onboarding.is_complete が false であること（スタッフもシフト枠も 0 件）。"""
        _create_org_and_member(db_session)
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["onboarding"]["is_complete"] is False

    def test_organizations_membership_contains_role(
        self, auth_client: TestClient, db_session
    ) -> None:
        """organizations[0].role が owner であること。"""
        _create_org_and_member(db_session)
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["organizations"][0]["role"] == "owner"

    def test_organizations_membership_contains_joined_at(
        self, auth_client: TestClient, db_session
    ) -> None:
        """organizations[0].joined_at が含まれること。"""
        _create_org_and_member(db_session)
        response = auth_client.get("/api/me")
        data = response.json()
        assert "joined_at" in data["organizations"][0]

    def test_organizations_membership_contains_organization_detail(
        self, auth_client: TestClient, db_session
    ) -> None:
        """organizations[0].organization に id / name / slug が含まれること。"""
        _create_org_and_member(db_session)
        response = auth_client.get("/api/me")
        data = response.json()
        org_detail = data["organizations"][0]["organization"]
        assert org_detail["id"] == TEST_ORG_ID
        assert org_detail["name"] == "テスト組織"
        assert org_detail["slug"] == TEST_ORG_SLUG


class TestGetMeWithOrganizationAndData:
    """認証あり・組織あり・初期データあり → onboarding.staff_count: N, shift_slot_count: M"""

    def test_onboarding_staff_count_reflects_actual_count(
        self, auth_client: TestClient, db_session
    ) -> None:
        """onboarding.staff_count がスタッフ件数を正しく反映すること。"""
        _create_org_and_member(db_session)
        _create_staff(db_session, org_id=TEST_ORG_ID, count=3)
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["onboarding"]["staff_count"] == 3

    def test_onboarding_shift_slot_count_reflects_actual_count(
        self, auth_client: TestClient, db_session
    ) -> None:
        """onboarding.shift_slot_count がシフト枠件数を正しく反映すること。"""
        _create_org_and_member(db_session)
        _create_shift_slots(db_session, org_id=TEST_ORG_ID, count=2)
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["onboarding"]["shift_slot_count"] == 2

    def test_onboarding_is_complete_true_when_both_exist(
        self, auth_client: TestClient, db_session
    ) -> None:
        """スタッフとシフト枠が両方 1 件以上あるとき is_complete が true になること。"""
        _create_org_and_member(db_session)
        _create_staff(db_session, org_id=TEST_ORG_ID, count=1)
        _create_shift_slots(db_session, org_id=TEST_ORG_ID, count=1)
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["onboarding"]["is_complete"] is True

    def test_onboarding_is_complete_false_when_only_staff_exists(
        self, auth_client: TestClient, db_session
    ) -> None:
        """スタッフのみ存在し、シフト枠がないとき is_complete が false であること。"""
        _create_org_and_member(db_session)
        _create_staff(db_session, org_id=TEST_ORG_ID, count=2)
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["onboarding"]["is_complete"] is False
        assert data["onboarding"]["staff_count"] == 2
        assert data["onboarding"]["shift_slot_count"] == 0

    def test_onboarding_is_complete_false_when_only_shift_slots_exist(
        self, auth_client: TestClient, db_session
    ) -> None:
        """シフト枠のみ存在し、スタッフがないとき is_complete が false であること。"""
        _create_org_and_member(db_session)
        _create_shift_slots(db_session, org_id=TEST_ORG_ID, count=2)
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["onboarding"]["is_complete"] is False
        assert data["onboarding"]["staff_count"] == 0
        assert data["onboarding"]["shift_slot_count"] == 2

    def test_other_org_data_not_counted(
        self, auth_client: TestClient, db_session
    ) -> None:
        """別組織のスタッフ・シフト枠は自組織のカウントに含まれないこと（テナント分離）。"""
        _create_org_and_member(db_session)

        # 別組織を作成（自分は所属しない）
        other_org_id = str(uuid.uuid4())
        other_org = Organization(
            id=other_org_id,
            name="他の組織",
            slug="other-org-slug-xyz",
        )
        db_session.add(other_org)
        db_session.commit()

        # 別組織にスタッフとシフト枠を追加
        _create_staff(db_session, org_id=other_org_id, count=5)
        _create_shift_slots(db_session, org_id=other_org_id, count=3)

        # 自組織にはデータなし
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["onboarding"]["staff_count"] == 0
        assert data["onboarding"]["shift_slot_count"] == 0
        assert data["onboarding"]["is_complete"] is False


class TestGetMeDeletedOrganizationExcluded:
    """論理削除された組織は除外されること。"""

    def test_deleted_org_excluded_from_organizations(
        self, auth_client: TestClient, db_session
    ) -> None:
        """論理削除された組織は organizations に含まれないこと。"""
        _create_org_and_member(
            db_session,
            deleted_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["organizations"] == []

    def test_deleted_org_current_organization_is_null(
        self, auth_client: TestClient, db_session
    ) -> None:
        """論理削除された組織のみ所属している場合、current_organization が null になること。"""
        _create_org_and_member(
            db_session,
            deleted_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["current_organization"] is None

    def test_deleted_org_onboarding_is_null(
        self, auth_client: TestClient, db_session
    ) -> None:
        """論理削除された組織のみ所属している場合、onboarding が null になること。"""
        _create_org_and_member(
            db_session,
            deleted_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        response = auth_client.get("/api/me")
        data = response.json()
        assert data["onboarding"] is None

    def test_active_org_returned_when_deleted_org_also_exists(
        self, auth_client: TestClient, db_session
    ) -> None:
        """アクティブな組織と論理削除された組織が混在するとき、アクティブな組織のみ返ること。"""
        # アクティブな組織を作成
        _create_org_and_member(db_session)

        # 論理削除された別の組織を作成
        deleted_org_id = str(uuid.uuid4())
        deleted_org = Organization(
            id=deleted_org_id,
            name="削除済み組織",
            slug="deleted-org-slug-abc",
            deleted_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        db_session.add(deleted_org)
        db_session.add(
            OrganizationMember(
                organization_id=deleted_org_id,
                user_id=TEST_USER_ID,
                role="member",
            )
        )
        db_session.commit()

        response = auth_client.get("/api/me")
        data = response.json()

        # 論理削除された組織は含まれない
        assert len(data["organizations"]) == 1
        assert data["organizations"][0]["organization"]["id"] == TEST_ORG_ID
        assert data["current_organization"]["id"] == TEST_ORG_ID
