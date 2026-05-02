"""内部認証 API (`/api/internal/auth/*`) のテスト。

Auth.js HTTP Adapter からの呼び出しを模擬する。X-Internal-Auth-Secret ヘッダによる
ガード、ユーザー CRUD、Magic Link トークンの作成と消費フローを検証する。
"""

from datetime import datetime, timedelta

import pytest

from backend.models import User, VerificationToken

SECRET = "test-secret-abc123"
HEADERS = {"X-Internal-Auth-Secret": SECRET}


@pytest.fixture(autouse=True)
def _set_secret_env(monkeypatch):
    monkeypatch.setenv("INTERNAL_AUTH_SECRET", SECRET)


# ---- Secret ガード ----


def test_missing_secret_header_returns_401(client):
    res = client.post(
        "/api/internal/auth/users",
        json={"email": "a@example.com"},
    )
    assert res.status_code == 401


def test_wrong_secret_returns_401(client):
    res = client.post(
        "/api/internal/auth/users",
        json={"email": "a@example.com"},
        headers={"X-Internal-Auth-Secret": "wrong"},
    )
    assert res.status_code == 401


def test_unconfigured_secret_returns_500(client, monkeypatch):
    monkeypatch.delenv("INTERNAL_AUTH_SECRET", raising=False)
    # モジュールロード時にキャッシュされた値も上書き
    import backend.api.internal_auth as ia

    monkeypatch.setattr(ia, "_INTERNAL_AUTH_SECRET", None)
    res = client.post(
        "/api/internal/auth/users",
        json={"email": "a@example.com"},
        headers={"X-Internal-Auth-Secret": "anything"},
    )
    assert res.status_code == 500


# ---- POST /users ----


def test_create_user_returns_201_with_uuid(client):
    res = client.post(
        "/api/internal/auth/users",
        json={"email": "new@example.com", "name": "Alice"},
        headers=HEADERS,
    )
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "new@example.com"
    assert body["name"] == "Alice"
    assert len(body["id"]) == 36  # UUID v4


def test_create_user_duplicate_email_returns_409(client):
    payload = {"email": "dup@example.com"}
    client.post("/api/internal/auth/users", json=payload, headers=HEADERS)
    res = client.post("/api/internal/auth/users", json=payload, headers=HEADERS)
    assert res.status_code == 409


# ---- GET /users/by-email ----


def test_get_user_by_email_returns_user(client):
    client.post(
        "/api/internal/auth/users",
        json={"email": "find@example.com"},
        headers=HEADERS,
    )
    res = client.get(
        "/api/internal/auth/users/by-email",
        params={"email": "find@example.com"},
        headers=HEADERS,
    )
    assert res.status_code == 200
    assert res.json()["email"] == "find@example.com"


def test_get_user_by_email_not_found_returns_404(client):
    res = client.get(
        "/api/internal/auth/users/by-email",
        params={"email": "missing@example.com"},
        headers=HEADERS,
    )
    assert res.status_code == 404


def test_get_user_by_email_excludes_soft_deleted(client, db_session):
    res = client.post(
        "/api/internal/auth/users",
        json={"email": "deleted@example.com"},
        headers=HEADERS,
    )
    user_id = res.json()["id"]
    user = db_session.get(User, user_id)
    user.deleted_at = datetime.utcnow()
    db_session.commit()

    res = client.get(
        "/api/internal/auth/users/by-email",
        params={"email": "deleted@example.com"},
        headers=HEADERS,
    )
    assert res.status_code == 404


# ---- GET /users/{id} と PATCH /users/{id} ----


def test_get_user_by_id_returns_user(client):
    res = client.post(
        "/api/internal/auth/users",
        json={"email": "byid@example.com"},
        headers=HEADERS,
    )
    user_id = res.json()["id"]
    res = client.get(f"/api/internal/auth/users/{user_id}", headers=HEADERS)
    assert res.status_code == 200
    assert res.json()["id"] == user_id


def test_patch_user_updates_fields(client):
    res = client.post(
        "/api/internal/auth/users",
        json={"email": "patch@example.com"},
        headers=HEADERS,
    )
    user_id = res.json()["id"]
    verified_at = "2026-05-02T10:00:00"
    res = client.patch(
        f"/api/internal/auth/users/{user_id}",
        json={"name": "NewName", "email_verified_at": verified_at},
        headers=HEADERS,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "NewName"
    assert body["email_verified_at"] is not None


# ---- POST /verification-tokens ----


def test_create_verification_token_returns_201(client):
    expires = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    res = client.post(
        "/api/internal/auth/verification-tokens",
        json={
            "identifier": "magic@example.com",
            "token": "tok-abc",
            "expires": expires,
        },
        headers=HEADERS,
    )
    assert res.status_code == 201
    assert res.json()["identifier"] == "magic@example.com"


# ---- POST /verification-tokens/use ----


def test_use_token_creates_new_user_when_not_exists(client, db_session):
    expires = datetime.utcnow() + timedelta(minutes=10)
    db_session.add(
        VerificationToken(
            identifier="newuser@example.com", token="tok1", expires=expires
        )
    )
    db_session.commit()

    res = client.post(
        "/api/internal/auth/verification-tokens/use",
        json={"identifier": "newuser@example.com", "token": "tok1"},
        headers=HEADERS,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "newuser@example.com"
    assert body["email_verified_at"] is not None

    # トークンが消費されていることを確認
    remaining = db_session.get(
        VerificationToken,
        {"identifier": "newuser@example.com", "token": "tok1"},
    )
    assert remaining is None


def test_use_token_returns_existing_user_and_marks_verified(client, db_session):
    client.post(
        "/api/internal/auth/users",
        json={"email": "existing@example.com"},
        headers=HEADERS,
    )
    expires = datetime.utcnow() + timedelta(minutes=10)
    db_session.add(
        VerificationToken(
            identifier="existing@example.com", token="tok2", expires=expires
        )
    )
    db_session.commit()

    res = client.post(
        "/api/internal/auth/verification-tokens/use",
        json={"identifier": "existing@example.com", "token": "tok2"},
        headers=HEADERS,
    )
    assert res.status_code == 200
    assert res.json()["email_verified_at"] is not None


def test_use_token_expired_returns_400_and_deletes_token(client, db_session):
    expires = datetime.utcnow() - timedelta(minutes=1)  # 既に期限切れ
    db_session.add(
        VerificationToken(identifier="exp@example.com", token="exptok", expires=expires)
    )
    db_session.commit()

    res = client.post(
        "/api/internal/auth/verification-tokens/use",
        json={"identifier": "exp@example.com", "token": "exptok"},
        headers=HEADERS,
    )
    assert res.status_code == 400
    # 期限切れトークンは削除されていることを確認（クリーンアップ）
    remaining = db_session.get(
        VerificationToken, {"identifier": "exp@example.com", "token": "exptok"}
    )
    assert remaining is None


def test_use_token_missing_returns_404(client):
    res = client.post(
        "/api/internal/auth/verification-tokens/use",
        json={"identifier": "ghost@example.com", "token": "nope"},
        headers=HEADERS,
    )
    assert res.status_code == 404
