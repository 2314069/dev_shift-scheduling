"""内部認証 API — Auth.js HTTP Adapter からのみ呼ばれる内部エンドポイント群。

すべてのエンドポイントは X-Internal-Auth-Secret ヘッダで保護されており、
INTERNAL_AUTH_SECRET 環境変数と一致しない場合は 401 を返す。
"""

import os
import uuid
from datetime import datetime, timezone


def _utcnow() -> datetime:
    """タイムゾーン情報を持たない UTC 現在時刻を返す（SQLite 互換）。"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, VerificationToken
from backend.schemas import (
    UserResponse,
    VerificationTokenCreate,
    VerificationTokenResponse,
)

# 起動時に環境変数を読み込む。未設定の場合は None とし、API 呼び出し時に 500 を返す。
# （テスト時は monkeypatch で設定するため、起動時エラーは避ける）
_INTERNAL_AUTH_SECRET: str | None = os.environ.get("INTERNAL_AUTH_SECRET")

router = APIRouter(prefix="/api/internal/auth", tags=["internal-auth"])


# ---- Secret ガード ----


def verify_internal_secret(
    x_internal_auth_secret: str | None = Header(default=None),
) -> None:
    """X-Internal-Auth-Secret ヘッダを検証する依存関数。

    Auth.js Adapter 以外からの呼び出しを防ぐために、
    各エンドポイントに Depends(verify_internal_secret) を付与する。
    """
    secret = os.environ.get("INTERNAL_AUTH_SECRET", _INTERNAL_AUTH_SECRET)
    if secret is None:
        # 環境変数未設定はサーバー設定ミスなので 500 で返す
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_AUTH_SECRET is not configured",
        )
    if x_internal_auth_secret is None or x_internal_auth_secret != secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Internal-Auth-Secret header",
        )


# ---- リクエスト / レスポンス スキーマ ----


class UserCreateRequest(BaseModel):
    """Auth.js Adapter の createUser() が送るペイロード。

    Auth.js 側が UUID を生成する場合もあるが、本 API 側で UUID を払い出すため
    id フィールドは受け付けない（冪等性は email unique 制約で担保）。
    """

    email: str
    name: str | None = None
    image: str | None = None


class UserUpdateRequest(BaseModel):
    """Auth.js Adapter の updateUser() が送るペイロード。すべてのフィールドは省略可。"""

    name: str | None = None
    image: str | None = None
    email_verified_at: datetime | None = None


class VerificationTokenUseRequest(BaseModel):
    """トークン消費エンドポイントのリクエスト。identifier + token の組み合わせで検索する。"""

    identifier: str
    token: str


# ---- エンドポイント ----


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_internal_secret)],
)
def create_user(
    data: UserCreateRequest,
    db: Session = Depends(get_db),
) -> User:
    """ユーザーを新規作成する。UUID は本 API 側で自動生成する。

    Auth.js Email Provider が初回サインイン時に呼ぶ。
    email が既に存在する場合は 409 を返す（Adapter 側で getUserByEmail を先に呼ぶ設計だが念のため）。
    """
    existing = db.query(User).filter(User.email == data.email).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{data.email}' already exists",
        )

    now = _utcnow()
    user = User(
        id=str(uuid.uuid4()),
        email=data.email,
        name=data.name,
        image=data.image,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get(
    "/users/by-email",
    response_model=UserResponse,
    dependencies=[Depends(verify_internal_secret)],
)
def get_user_by_email(
    email: str,
    db: Session = Depends(get_db),
) -> User:
    """メールアドレスでユーザーを検索する。論理削除済みユーザーは 404 を返す。

    Auth.js Adapter の getUserByEmail() に対応する。
    """
    user = db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.get(
    "/users/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(verify_internal_secret)],
)
def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
) -> User:
    """ID でユーザーを検索する。論理削除済みユーザーも返す（Auth.js 内部での整合性チェック用）。

    Auth.js Adapter の getUser() に対応する。
    """
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(verify_internal_secret)],
)
def update_user(
    user_id: str,
    data: UserUpdateRequest,
    db: Session = Depends(get_db),
) -> User:
    """ユーザー情報を部分更新する。

    Auth.js Adapter の updateUser() に対応する。
    email_verified_at はメール確認完了時に Auth.js から書き込まれる。
    """
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    user.updated_at = _utcnow()

    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/verification-tokens",
    response_model=VerificationTokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_internal_secret)],
)
def create_verification_token(
    data: VerificationTokenCreate,
    db: Session = Depends(get_db),
) -> VerificationToken:
    """Magic Link 用のトークンを保存する。

    Auth.js Email Provider が sendVerificationRequest() の前に呼ぶ。
    identifier（email）+ token の複合 PK なので、同一メール宛の再送も区別して保存できる。
    """
    token = VerificationToken(
        identifier=data.identifier,
        token=data.token,
        expires=data.expires,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


@router.post(
    "/verification-tokens/use",
    response_model=VerificationTokenResponse,
    dependencies=[Depends(verify_internal_secret)],
)
def use_verification_token(
    data: VerificationTokenUseRequest,
    db: Session = Depends(get_db),
) -> VerificationTokenResponse:
    """Magic Link トークンを消費し、消費したトークン情報を返す。

    Auth.js Email Provider の `useVerificationToken` Adapter コールバックは
    VerificationToken（identifier / token / expires）を返すことを期待する。
    User を返すと Auth.js 側で expires が Invalid Date になり「期限切れ」と
    誤判定されるため、必ず VerificationToken 形式で返す。

    処理フロー（すべて同一トランザクション内で実行し、失敗時はロールバック）:
    1. identifier + token でトークンを検索
    2. 期限切れチェック
    3. トークンを削除（使い捨て）
    4. ユーザーを upsert（新規なら作成、既存なら email_verified_at を更新）
       後続の getUserByEmail で確実にユーザーが見つかるよう atomically に行う
    5. 削除したトークン情報を返す（identifier / token / expires）
    """
    vtoken = db.get(
        VerificationToken,
        {"identifier": data.identifier, "token": data.token},
    )
    if vtoken is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification token not found",
        )

    now = _utcnow()
    if vtoken.expires < now:
        # 期限切れトークンは削除してから 400 を返す（クリーンアップを兼ねる）
        db.delete(vtoken)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired",
        )

    # 削除前にレスポンス用のスナップショットを取る
    response = VerificationTokenResponse(
        identifier=vtoken.identifier,
        token=vtoken.token,
        expires=vtoken.expires,
    )

    # トークンを削除（使い捨て）
    db.delete(vtoken)

    # ユーザーを upsert（後続の getUserByEmail で確実にヒットさせるため atomically に）
    user = (
        db.query(User)
        .filter(User.email == data.identifier, User.deleted_at.is_(None))
        .first()
    )
    if user is None:
        user = User(
            id=str(uuid.uuid4()),
            email=data.identifier,
            email_verified_at=now,
            created_at=now,
            updated_at=now,
        )
        db.add(user)
    else:
        user.email_verified_at = now
        user.updated_at = now

    db.commit()
    return response
