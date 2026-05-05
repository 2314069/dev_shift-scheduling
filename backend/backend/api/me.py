"""GET /api/me — 認証ユーザー情報 + 所属組織 + オンボーディング状態の統合レスポンス。"""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import (
    Organization,
    OrganizationMember,
    ShiftSlotModel,
    StaffModel,
    User,
)
from backend.schemas import (
    CurrentOrganizationSummary,
    MeResponse,
    OnboardingStateResponse,
    OrganizationMembershipResponse,
    OrganizationResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/me", tags=["me"])


@router.get("", response_model=MeResponse)
def get_me(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeResponse:
    """ナビゲーション・ルーティング判定用の統合レスポンス。

    - organizations: 論理削除組織を除外
    - current_organization: 最初の所属組織（複数所属時の選択は将来対応）
    - onboarding: current_organization が存在するときのみ staff/shift_slots カウントを返す
    """
    # 状態が頻繁に変わるためブラウザ・CDN キャッシュを禁止する
    response.headers["Cache-Control"] = "no-store"

    # 論理削除されていない所属組織を取得
    members = (
        db.query(OrganizationMember)
        .join(Organization, Organization.id == OrganizationMember.organization_id)
        .filter(
            OrganizationMember.user_id == current_user.id,
            Organization.deleted_at.is_(None),
        )
        .all()
    )

    organizations = [
        OrganizationMembershipResponse(
            organization=OrganizationResponse.model_validate(m.organization),
            role=m.role,
            joined_at=m.joined_at,
        )
        for m in members
    ]

    # current_organization: get_current_org_id と整合して最初の 1 件を選ぶ
    # 複数組織所属時の選択ロジックは将来対応（Phase 0 完了レビュー [#m2]）
    current_organization: CurrentOrganizationSummary | None = None
    onboarding: OnboardingStateResponse | None = None

    if members:
        first_member = members[0]
        first_org = first_member.organization
        current_organization = CurrentOrganizationSummary(
            id=first_org.id,
            name=first_org.name,
            slug=first_org.slug,
            role=first_member.role,
        )

        # 初期データガイド表示判定: staff と shift_slots の件数をカウント
        staff_count = (
            db.query(StaffModel)
            .filter(StaffModel.organization_id == first_org.id)
            .count()
        )
        shift_slot_count = (
            db.query(ShiftSlotModel)
            .filter(ShiftSlotModel.organization_id == first_org.id)
            .count()
        )
        onboarding = OnboardingStateResponse(
            staff_count=staff_count,
            shift_slot_count=shift_slot_count,
            is_complete=staff_count > 0 and shift_slot_count > 0,
        )

    return MeResponse(
        user=UserResponse.model_validate(current_user),
        organizations=organizations,
        current_organization=current_organization,
        onboarding=onboarding,
    )
