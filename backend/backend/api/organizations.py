"""組織作成・所属組織取得 API（Phase 1-1 オンボーディング）。

ユーザーが「自分の組織」を 1 つ作成するためのエンドポイント。
get_current_user のみに依存し、get_current_org_id には依存しない（組織未所属で叩ける必要があるため）。
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import Organization, OrganizationMember, User
from backend.schemas import (
    OrganizationCreateRequest,
    OrganizationMembershipResponse,
    OrganizationResponse,
)

router = APIRouter(prefix="/api/organizations", tags=["organizations"])

# slug 衝突時の最大リトライ回数（5 回連続衝突は宇宙の終わり）
_SLUG_MAX_RETRIES = 5


def _generate_slug(db: Session) -> str:
    """UUID v4 の hex 先頭 12 文字で slug を生成し、DB 衝突がなければ返す。

    最大 _SLUG_MAX_RETRIES 回リトライし、それでも衝突する場合は None を返す。
    """
    for _ in range(_SLUG_MAX_RETRIES):
        candidate = uuid.uuid4().hex[:12]
        existing = db.query(Organization).filter(Organization.slug == candidate).first()
        if existing is None:
            return candidate
    # 5 回全て衝突した場合（極めて稀）
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Organization slug conflict, please retry",
    )


@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization(
    data: OrganizationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Organization:
    """新規組織を作成し、呼び出しユーザーを owner Member として登録する。

    - 既に owner 組織を持つユーザーは 409
    - slug は UUID v4 hex の先頭 12 文字を使い、衝突時は最大 5 回リトライ
    - Organization と OrganizationMember は同一トランザクション内で作成
    """
    # フェイルファースト: 同一ユーザーが既に owner 組織を所有していないか確認
    existing_owner_member = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.role == "owner",
        )
        .first()
    )
    if existing_owner_member is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already own an organization",
        )

    slug = _generate_slug(db)
    org_id = str(uuid.uuid4())

    try:
        org = Organization(
            id=org_id,
            name=data.name,
            slug=slug,
        )
        db.add(org)

        member = OrganizationMember(
            organization_id=org_id,
            user_id=current_user.id,
            role="owner",
        )
        db.add(member)

        # Organization と OrganizationMember を同一トランザクションでコミット
        db.commit()
        db.refresh(org)
    except IntegrityError:
        db.rollback()
        # slug が並行リクエストと衝突した場合も 409 で返す
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization slug conflict, please retry",
        )

    return org


@router.get(
    "/me",
    response_model=list[OrganizationMembershipResponse],
)
def list_my_organizations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list:
    """自分の所属組織一覧を返す。論理削除組織は除外する。"""
    members = (
        db.query(OrganizationMember)
        .join(Organization, Organization.id == OrganizationMember.organization_id)
        .filter(
            OrganizationMember.user_id == current_user.id,
            Organization.deleted_at.is_(None),
        )
        .all()
    )

    # OrganizationMembershipResponse は from_attributes=True だが、
    # OrganizationMember の organization リレーションを使ってネストして返す
    return [
        OrganizationMembershipResponse(
            organization=OrganizationResponse.model_validate(m.organization),
            role=m.role,
            joined_at=m.joined_at,
        )
        for m in members
    ]
