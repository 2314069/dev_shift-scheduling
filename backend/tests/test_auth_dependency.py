"""get_current_user Dependency の単体テスト。

Auth.js v5 互換の JWE トークンを生成して実認証パスを通す。
conftest.py の dependency_overrides は使わず、実際の get_current_user を実行する。
"""

import json
import time
import uuid

import pytest
from fastapi.testclient import TestClient
from joserfc import jwe
from joserfc.jwk import OctKey
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.auth import _derive_encryption_key, get_current_user
from backend.database import Base, get_db
from backend.main import app
from backend.models import User

# テスト用定数
_TEST_SECRET = "test-secret-for-auth-dependency-tests"
_TEST_COOKIE_NAME = "authjs.session-token"


# --- ヘルパー関数 ---


def _make_jwe_token(
    sub: str,
    secret: str = _TEST_SECRET,
    cookie_name: str = _TEST_COOKIE_NAME,
    exp_offset: int = 3600,
) -> str:
    """テスト用 JWE トークンを生成する。Auth.js v5 と同一のアルゴリズムを使用。"""
    key_bytes = _derive_encryption_key(secret, cookie_name)
    key = OctKey.import_key(key_bytes)
    payload = json.dumps({"sub": sub, "exp": int(time.time()) + exp_offset}).encode()
    return jwe.encrypt_compact({"alg": "dir", "enc": "A256CBC-HS512"}, payload, key)


# --- フィクスチャ ---


@pytest.fixture
def auth_db_session():
    """認証テスト専用のインメモリ DB セッション。"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def auth_client(auth_db_session, monkeypatch):
    """dependency_overrides を使わない認証テスト専用クライアント。

    AUTH_SECRET を monkeypatch で設定し、get_current_user の実装を通す。
    """
    monkeypatch.setenv("AUTH_SECRET", _TEST_SECRET)
    monkeypatch.setenv("AUTH_COOKIE_NAME", _TEST_COOKIE_NAME)

    def override_get_db():
        yield auth_db_session

    # get_current_user の override は設定しない（実認証を通す）
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


@pytest.fixture
def existing_user(auth_db_session) -> User:
    """DB に保存済みのアクティブユーザー。OrganizationMember 付きで作成する。"""
    from backend.models import Organization, OrganizationMember

    org = Organization(
        id="auth-test-org-id", name="Auth Test Org", slug="auth-test-org"
    )
    auth_db_session.add(org)
    auth_db_session.flush()

    user = User(
        id=str(uuid.uuid4()),
        email="active@example.com",
        name="Active User",
    )
    auth_db_session.add(user)
    auth_db_session.flush()

    member = OrganizationMember(
        organization_id="auth-test-org-id",
        user_id=user.id,
        role="owner",
    )
    auth_db_session.add(member)
    auth_db_session.commit()
    auth_db_session.refresh(user)
    return user


@pytest.fixture
def deleted_user(auth_db_session) -> User:
    """論理削除済みユーザー（deleted_at が設定済み）。"""
    from datetime import datetime, timezone

    user = User(
        id=str(uuid.uuid4()),
        email="deleted@example.com",
        name="Deleted User",
        deleted_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    auth_db_session.add(user)
    auth_db_session.commit()
    auth_db_session.refresh(user)
    return user


# --- テストケース ---


def test_no_cookie_returns_401(auth_client):
    """Cookie もヘッダもなければ 401 を返す。"""
    response = auth_client.get("/api/staff")
    assert response.status_code == 401
    assert "Not authenticated" in response.json()["detail"]


def test_invalid_jwt_returns_401(auth_client):
    """不正な形式のトークンは 401 を返す。"""
    # client.cookies に設定してリクエスト後に削除する方式で警告を回避する
    auth_client.cookies.set("authjs.session-token", "this.is.not.a.valid.token")
    response = auth_client.get("/api/staff")
    auth_client.cookies.clear()
    assert response.status_code == 401


def test_expired_jwt_returns_401(auth_client, existing_user):
    """期限切れトークン（exp が過去）は 401 を返す。"""
    token = _make_jwe_token(sub=existing_user.id, exp_offset=-3600)
    auth_client.cookies.set("authjs.session-token", token)
    response = auth_client.get("/api/staff")
    auth_client.cookies.clear()
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_valid_jwt_returns_200(auth_client, existing_user):
    """有効なトークンで認証済みユーザーが居れば 200 を返す。"""
    token = _make_jwe_token(sub=existing_user.id)
    auth_client.cookies.set("authjs.session-token", token)
    response = auth_client.get("/api/staff")
    auth_client.cookies.clear()
    assert response.status_code == 200


def test_deleted_user_jwt_returns_401(auth_client, deleted_user):
    """論理削除済みユーザーの sub を持つトークンは 401 を返す。"""
    token = _make_jwe_token(sub=deleted_user.id)
    auth_client.cookies.set("authjs.session-token", token)
    response = auth_client.get("/api/staff")
    auth_client.cookies.clear()
    assert response.status_code == 401
    assert "deleted" in response.json()["detail"].lower()


def test_nonexistent_user_jwt_returns_401(auth_client):
    """DB に存在しないユーザー ID の sub を持つトークンは 401 を返す。"""
    token = _make_jwe_token(sub="nonexistent-user-id")
    auth_client.cookies.set("authjs.session-token", token)
    response = auth_client.get("/api/staff")
    auth_client.cookies.clear()
    assert response.status_code == 401


def test_bearer_header_authentication(auth_client, existing_user):
    """Authorization: Bearer ヘッダ経由でも認証できる（テスト・SSR 用フォールバック）。"""
    token = _make_jwe_token(sub=existing_user.id)
    response = auth_client.get(
        "/api/staff",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200


def test_wrong_secret_returns_401(auth_client, existing_user, monkeypatch):
    """AUTH_SECRET と異なる秘密鍵で署名されたトークンは 401 を返す。"""
    token = _make_jwe_token(sub=existing_user.id, secret="completely-different-secret")
    auth_client.cookies.set("authjs.session-token", token)
    response = auth_client.get("/api/staff")
    auth_client.cookies.clear()
    assert response.status_code == 401


# --- E2E バイパスの fail-close テスト ---


def test_e2e_bypass_disabled_when_app_env_unset(auth_client, monkeypatch):
    """APP_ENV 未設定時は BYPASS_AUTH_FOR_E2E=1 でもバイパスは無効（fail-close）。"""
    monkeypatch.setenv("BYPASS_AUTH_FOR_E2E", "1")
    monkeypatch.delenv("APP_ENV", raising=False)
    response = auth_client.get("/api/staff")
    assert response.status_code == 401


def test_e2e_bypass_disabled_when_app_env_production(auth_client, monkeypatch):
    """APP_ENV=production では BYPASS_AUTH_FOR_E2E=1 でもバイパスは無効。"""
    monkeypatch.setenv("BYPASS_AUTH_FOR_E2E", "1")
    monkeypatch.setenv("APP_ENV", "production")
    response = auth_client.get("/api/staff")
    assert response.status_code == 401


def test_e2e_bypass_disabled_when_app_env_unknown(auth_client, monkeypatch):
    """ホワイトリスト外の APP_ENV（staging 等）では BYPASS_AUTH_FOR_E2E=1 でもバイパス無効。"""
    monkeypatch.setenv("BYPASS_AUTH_FOR_E2E", "1")
    monkeypatch.setenv("APP_ENV", "staging")
    response = auth_client.get("/api/staff")
    assert response.status_code == 401


def test_e2e_bypass_active_when_app_env_test(auth_client, monkeypatch):
    """APP_ENV=test + BYPASS_AUTH_FOR_E2E=1 のときのみバイパスが有効化される。"""
    monkeypatch.setenv("BYPASS_AUTH_FOR_E2E", "1")
    monkeypatch.setenv("APP_ENV", "test")
    response = auth_client.get("/api/staff")
    assert response.status_code == 200


def test_e2e_bypass_active_when_app_env_development(auth_client, monkeypatch):
    """APP_ENV=development + BYPASS_AUTH_FOR_E2E=1 でもバイパスが有効化される。"""
    monkeypatch.setenv("BYPASS_AUTH_FOR_E2E", "1")
    monkeypatch.setenv("APP_ENV", "development")
    response = auth_client.get("/api/staff")
    assert response.status_code == 200


def test_e2e_bypass_disabled_when_flag_not_set(auth_client, monkeypatch):
    """APP_ENV=test でも BYPASS_AUTH_FOR_E2E が未設定ならバイパスは無効。"""
    monkeypatch.delenv("BYPASS_AUTH_FOR_E2E", raising=False)
    monkeypatch.setenv("APP_ENV", "test")
    response = auth_client.get("/api/staff")
    assert response.status_code == 401
