"""FastAPI 認証 Dependency モジュール。

Auth.js v5 が発行した JWE トークン（dir + A256CBC-HS512）を検証し、
ログイン済みユーザーを返す。バックエンドと Auth.js で AUTH_SECRET を共有し、
HKDF で鍵を導出することで stateless 検証を実現する。

Auth.js v5 の JWT 仕様:
- アルゴリズム: dir（Direct key agreement）+ A256CBC-HS512
- 鍵導出: HKDF-SHA256(keyMaterial=AUTH_SECRET, salt=cookieName,
          info="Auth.js Generated Encryption Key ({cookieName})", length=64)
- Cookie 名: authjs.session-token（開発）/ __Secure-authjs.session-token（本番）
  -> 環境変数 AUTH_COOKIE_NAME で切り替え
"""

import json
import os
import time
from functools import lru_cache

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from fastapi import Cookie, Depends, Header, HTTPException, status
from joserfc import jwe
from joserfc.errors import JoseError
from joserfc.jwk import OctKey
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User

# --- 設定 ---

# 起動時にはエラーにせず、実際の API 呼び出し時に未設定を検知する。
# これにより pytest の収集フェーズでのクラッシュを回避できる。
_AUTH_SECRET: str | None = os.environ.get("AUTH_SECRET")

# Cookie 名: 本番は環境変数 AUTH_COOKIE_NAME で "__Secure-authjs.session-token" に切り替える
COOKIE_NAME: str = os.environ.get("AUTH_COOKIE_NAME", "authjs.session-token")


# --- 鍵導出 ---


@lru_cache(maxsize=8)
def _derive_encryption_key(secret: str, salt: str) -> bytes:
    """Auth.js と同一の HKDF-SHA256 で暗号化鍵を導出する。

    Auth.js のソース（@auth/core/src/jwt.ts）に合わせて:
    - length: 64 バイト（A256CBC-HS512 用）
    - info: "Auth.js Generated Encryption Key ({salt})"

    同一 secret + salt の組み合わせに対してはキャッシュする。
    """
    info = f"Auth.js Generated Encryption Key ({salt})".encode()
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=64,
        salt=salt.encode(),
        info=info,
        backend=default_backend(),
    )
    return hkdf.derive(secret.encode())


def _decode_jwe(token: str, secret: str, cookie_name: str) -> dict:
    """JWE トークンを復号してペイロード dict を返す。

    検証失敗（署名不一致・期限切れ・不正形式）の場合は HTTPException(401) を投げる。
    """
    try:
        key_bytes = _derive_encryption_key(secret, cookie_name)
        key = OctKey.import_key(key_bytes)
        result = jwe.decrypt_compact(token, key)
        payload: dict = json.loads(result.plaintext)
    except (JoseError, Exception) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or malformed token",
        ) from exc

    # 有効期限チェック（exp クレーム）
    exp = payload.get("exp")
    if exp is not None and int(exp) < int(time.time()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )

    return payload


# --- Dependency ---


def get_current_user(
    # Cookie 名は実行時に COOKIE_NAME を参照するため、alias を動的に設定できない。
    # FastAPI の Cookie() は import 時に評価されるため、alias に変数は使えない。
    # 代わりに両方の Cookie 名を受け取り、いずれかがあれば使う方式を採用する。
    session_token: str | None = Cookie(default=None, alias="authjs.session-token"),
    secure_session_token: str | None = Cookie(
        default=None, alias="__Secure-authjs.session-token"
    ),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """現在のリクエストのログイン済みユーザーを返す FastAPI Dependency。

    トークン取得優先順位:
    1. Cookie `authjs.session-token`（開発環境）
    2. Cookie `__Secure-authjs.session-token`（本番環境）
    3. Authorization: Bearer ヘッダ（テスト・SSR 用）

    以下の場合は 401 を返す:
    - トークンが存在しない
    - AUTH_SECRET が未設定（サーバー設定ミスを 401 で隠さないため実際は 500 だが、
      テスト用に AUTH_SECRET を monkeypatch で設定できるよう os.environ から動的に読む）
    - JWE 復号失敗
    - exp クレームが現在時刻より前
    - users テーブルにユーザーが存在しない
    - ユーザーが論理削除済み（deleted_at IS NOT NULL）
    """
    # AUTH_SECRET は起動後に変わる可能性があるので都度読む
    secret = os.environ.get("AUTH_SECRET", _AUTH_SECRET)
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AUTH_SECRET is not configured",
        )

    # Cookie 名は環境変数で切り替え可能。両方受け取って優先順位で選択する。
    cookie_name = os.environ.get("AUTH_COOKIE_NAME", "authjs.session-token")
    if cookie_name == "__Secure-authjs.session-token":
        raw_token = secure_session_token
    else:
        raw_token = session_token

    # Authorization ヘッダのフォールバック（テスト・SSR 用）
    if not raw_token and authorization:
        raw_token = authorization.removeprefix("Bearer ").strip() or None

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = _decode_jwe(raw_token, secret, cookie_name)

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing sub claim",
        )

    # 論理削除チェックを含む DB 検索（毎リクエスト 1 SELECT; Phase 0-1 ではキャッシュなし）
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or has been deleted",
        )

    return user
