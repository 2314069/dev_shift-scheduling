"""POST /api/organizations と GET /api/organizations/me の単体テスト。

conftest.py の client フィクスチャは get_current_user / get_current_org_id をスタブに
差し替えているため、そのまま使うと認証のテストができない。
認証なし (401) のテストは dependency_overrides を使わない専用の client を都度用意する。
"""

import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError as SAIntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.auth import get_current_org_id, get_current_user
from backend.database import Base, get_db
from backend.main import app
from backend.models import Organization, OrganizationMember, User

# テスト用固定値
TEST_ORG_ID = "test-org-uuid-0000"
TEST_ORG_SLUG = "test-org"
TEST_USER_ID = "test-user-uuid-0000"
TEST_USER_ID_2 = "test-user-uuid-1111"


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
    """テスト用スタブユーザー。"""
    user = MagicMock(spec=User)
    user.id = user_id
    user.email = "test@example.com"
    user.name = "テストユーザー"
    user.image = None
    user.email_verified_at = None
    user.created_at = None
    user.updated_at = None
    user.deleted_at = None
    return user


@pytest.fixture
def auth_client(db_session):
    """認証済みクライアント（get_current_user をスタブに差し替え）。

    get_current_org_id はオーバーライドしない（組織未所属ユーザーのテストのため）。
    """

    def override_get_db():
        yield db_session

    stub_user = _make_stub_user()

    def override_get_current_user():
        return stub_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    # get_current_org_id はオーバーライドしない（organizations API は依存しない）
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def unauth_client(db_session, monkeypatch):
    """認証なしクライアント（dependency_overrides を一切使わない）。

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
# POST /api/organizations テスト
# ---------------------------------------------------------------------------


def test_create_organization_unauthenticated(unauth_client):
    """認証なしで 401 が返ること。"""
    response = unauth_client.post(
        "/api/organizations",
        json={"name": "テスト食堂"},
    )
    assert response.status_code == 401


def test_create_organization_success(auth_client, db_session):
    """正常系: 201 が返り、Organization と OrganizationMember(role=owner) が DB に作成される。"""
    response = auth_client.post(
        "/api/organizations",
        json={"name": "シフトすけっと食堂 渋谷店"},
    )
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "シフトすけっと食堂 渋谷店"
    assert "id" in data
    assert "slug" in data
    assert len(data["slug"]) == 12  # uuid4().hex[:12]
    assert "created_at" in data
    assert "updated_at" in data
    assert data["deleted_at"] is None

    org_id = data["id"]

    # DB に Organization が作成されているか確認
    org = db_session.query(Organization).filter(Organization.id == org_id).first()
    assert org is not None
    assert org.name == "シフトすけっと食堂 渋谷店"

    # DB に OrganizationMember(role=owner) が同一 TX で作成されているか確認
    member = (
        db_session.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == TEST_USER_ID,
        )
        .first()
    )
    assert member is not None
    assert member.role == "owner"


def test_create_organization_duplicate_owner(auth_client, db_session):
    """同一ユーザーが 2 つ目の owner 組織を作ろうとすると 409 が返ること。"""
    # 1 つ目を作成
    first_response = auth_client.post(
        "/api/organizations",
        json={"name": "最初の店"},
    )
    assert first_response.status_code == 201

    # 2 つ目を作成しようとすると 409
    second_response = auth_client.post(
        "/api/organizations",
        json={"name": "2 店目"},
    )
    assert second_response.status_code == 409
    assert "already own" in second_response.json()["detail"].lower()


def test_create_organization_empty_name(auth_client):
    """空文字の name は 422 が返ること。"""
    response = auth_client.post(
        "/api/organizations",
        json={"name": ""},
    )
    assert response.status_code == 422


def test_create_organization_whitespace_only_name(auth_client):
    """空白のみの name は 422 が返ること（strip 後に空文字になるため）。"""
    response = auth_client.post(
        "/api/organizations",
        json={"name": "   "},
    )
    assert response.status_code == 422


def test_create_organization_name_too_long(auth_client):
    """101 文字を超える name は 422 が返ること。"""
    response = auth_client.post(
        "/api/organizations",
        json={"name": "あ" * 101},
    )
    assert response.status_code == 422


def test_create_organization_name_100_chars_ok(auth_client):
    """ちょうど 100 文字の name は正常に作成できること。"""
    response = auth_client.post(
        "/api/organizations",
        json={"name": "あ" * 100},
    )
    assert response.status_code == 201


def test_create_organization_name_is_stripped(auth_client, db_session):
    """前後の空白は strip されて保存されること。"""
    response = auth_client.post(
        "/api/organizations",
        json={"name": "  テスト食堂  "},
    )
    assert response.status_code == 201
    assert response.json()["name"] == "テスト食堂"


# ---------------------------------------------------------------------------
# GET /api/organizations/me テスト
# ---------------------------------------------------------------------------


def test_list_my_organizations_unauthenticated(unauth_client):
    """認証なしで 401 が返ること。"""
    response = unauth_client.get("/api/organizations/me")
    assert response.status_code == 401


def test_list_my_organizations_no_membership(auth_client):
    """組織未所属のとき 200 で空配列が返ること。"""
    response = auth_client.get("/api/organizations/me")
    assert response.status_code == 200
    assert response.json() == []


def test_list_my_organizations_with_membership(auth_client, db_session):
    """組織所属済みのとき 200 で所属組織リストが返ること。"""
    # 組織と Member を DB に直接作成
    org = Organization(
        id=str(uuid.uuid4()),
        name="テスト組織",
        slug="test-slug-abc",
    )
    db_session.add(org)
    member = OrganizationMember(
        organization_id=org.id,
        user_id=TEST_USER_ID,
        role="owner",
    )
    db_session.add(member)
    db_session.commit()

    response = auth_client.get("/api/organizations/me")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["organization"]["id"] == org.id
    assert data[0]["organization"]["name"] == "テスト組織"
    assert data[0]["role"] == "owner"
    assert "joined_at" in data[0]


def test_list_my_organizations_excludes_deleted(auth_client, db_session):
    """論理削除された組織は一覧から除外されること。"""
    from datetime import datetime, timezone

    org_active = Organization(
        id=str(uuid.uuid4()),
        name="アクティブ組織",
        slug="active-slug-abc",
    )
    org_deleted = Organization(
        id=str(uuid.uuid4()),
        name="削除済み組織",
        slug="deleted-slug-abc",
        deleted_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db_session.add(org_active)
    db_session.add(org_deleted)

    db_session.add(
        OrganizationMember(
            organization_id=org_active.id,
            user_id=TEST_USER_ID,
            role="owner",
        )
    )
    db_session.add(
        OrganizationMember(
            organization_id=org_deleted.id,
            user_id=TEST_USER_ID,
            role="member",
        )
    )
    db_session.commit()

    response = auth_client.get("/api/organizations/me")
    assert response.status_code == 200

    data = response.json()
    # 論理削除された組織は含まれない
    assert len(data) == 1
    assert data[0]["organization"]["name"] == "アクティブ組織"


# ---------------------------------------------------------------------------
# Major-1 対応: uq_one_owner_per_user 部分 UNIQUE インデックスの動作確認
# ---------------------------------------------------------------------------


class TestOwnerUniqueIndexRaceConditionGuard:
    """uq_one_owner_per_user 部分 UNIQUE インデックスが race condition を防ぐことを確認。

    SELECT→INSERT 間の race を DB レベルで阻止するために追加した
    部分 UNIQUE インデックス（user_id WHERE role='owner'）の動作を検証する。

    Reviewer Major-1 差し戻し対応。
    Phase 1-1 設計書 §3.1「スキーマ変更なし」方針に対して、
    インデックス追加のみで対応するため Alembic マイグレーション 0002 を追加した。
    """

    def test_direct_insert_second_owner_raises_integrity_error(self, db_engine):
        """同一ユーザーで 2 件の owner Member を直接 INSERT すると IntegrityError になること。

        これが race condition の代理テスト。実際の race では 2 並行リクエストが
        両方とも「owner なし」と判定して INSERT するが、DB の部分 UNIQUE インデックスが
        2 件目の INSERT で IntegrityError を発生させることを確認する。
        """
        Session = sessionmaker(bind=db_engine)
        session = Session()

        user_id = str(uuid.uuid4())
        user = User(id=user_id, email="race_test@example.com")
        session.add(user)

        org1 = Organization(
            id=str(uuid.uuid4()), name="店舗A", slug=uuid.uuid4().hex[:12]
        )
        org2 = Organization(
            id=str(uuid.uuid4()), name="店舗B", slug=uuid.uuid4().hex[:12]
        )
        session.add(org1)
        session.add(org2)
        session.commit()

        # 1 件目の owner Member INSERT: 成功するはず
        member1 = OrganizationMember(
            organization_id=org1.id,
            user_id=user_id,
            role="owner",
        )
        session.add(member1)
        session.commit()

        # 2 件目の owner Member INSERT: uq_one_owner_per_user により IntegrityError
        member2 = OrganizationMember(
            organization_id=org2.id,
            user_id=user_id,
            role="owner",
        )
        session.add(member2)
        with pytest.raises(SAIntegrityError):
            session.commit()

        session.rollback()
        session.close()

    def test_different_users_can_each_have_owner_role(self, db_engine):
        """異なるユーザーはそれぞれ別組織で owner になれること（インデックスが過剰制約でないこと）。"""
        Session = sessionmaker(bind=db_engine)
        session = Session()

        user_a_id = str(uuid.uuid4())
        user_b_id = str(uuid.uuid4())
        user_a = User(id=user_a_id, email="user_a@example.com")
        user_b = User(id=user_b_id, email="user_b@example.com")
        session.add(user_a)
        session.add(user_b)

        org_a = Organization(
            id=str(uuid.uuid4()), name="A の店", slug=uuid.uuid4().hex[:12]
        )
        org_b = Organization(
            id=str(uuid.uuid4()), name="B の店", slug=uuid.uuid4().hex[:12]
        )
        session.add(org_a)
        session.add(org_b)
        session.commit()

        # 異なるユーザーがそれぞれ owner になれる
        member_a = OrganizationMember(
            organization_id=org_a.id, user_id=user_a_id, role="owner"
        )
        member_b = OrganizationMember(
            organization_id=org_b.id, user_id=user_b_id, role="owner"
        )
        session.add(member_a)
        session.add(member_b)
        # IntegrityError が発生しないこと
        session.commit()

        session.close()

    def test_api_second_create_returns_409(self, auth_client):
        """API 経由で 2 回目の組織作成リクエストが 409 を返すこと（既存テストの補完）。

        部分 UNIQUE インデックスによって SELECT なしでも 409 が正しく返ることを確認する。
        """
        # 1 件目: 成功
        resp1 = auth_client.post("/api/organizations", json={"name": "最初の店"})
        assert resp1.status_code == 201

        # 2 件目: インデックス違反で 409 になること
        resp2 = auth_client.post("/api/organizations", json={"name": "2 店目"})
        assert resp2.status_code == 409
        assert "already own" in resp2.json()["detail"].lower()
