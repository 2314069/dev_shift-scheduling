"""組織作成・所属組織取得・組織削除 API（Phase 1-1 オンボーディング / Phase 1-8 退会）。

ユーザーが「自分の組織」を 1 つ作成・削除するためのエンドポイント。
get_current_user のみに依存し、get_current_org_id には依存しない（組織未所属で叩ける必要があるため）。
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import (
    Organization,
    OrganizationMember,
    RoleStaffingRequirementModel,
    ScheduleAssignmentModel,
    SchedulePeriodModel,
    ShiftSlotModel,
    SkillRequirementModel,
    SolverConfigModel,
    StaffingRequirementModel,
    StaffModel,
    StaffRequestModel,
    StaffSkillModel,
    User,
)
from backend.schemas import (
    OrganizationCreateRequest,
    OrganizationMembershipResponse,
    OrganizationResponse,
)

router = APIRouter(prefix="/api/organizations", tags=["organizations"])

# slug 衝突時の最大リトライ回数（5 回連続衝突は宇宙の終わり）
_SLUG_MAX_RETRIES = 5


def _generate_slug() -> str:
    """UUID v4 の hex 先頭 12 文字で slug 候補を生成して返す。

    Minor-1 対応: SELECT による事前確認を省き、INSERT 時の IntegrityError で
    ループリトライする方式に変更。呼び出し側が _SLUG_MAX_RETRIES 回リトライする。
    """
    return uuid.uuid4().hex[:12]


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

    - 既に owner 組織を持つユーザーは 409（DB の部分 UNIQUE インデックスで保証）
    - slug は UUID v4 hex の先頭 12 文字を使い、衝突時は最大 5 回リトライ
    - Organization と OrganizationMember は同一トランザクション内で作成

    Major-1 対応（race condition 修正）:
      従来の SELECT→INSERT 方式では並行リクエスト時に両方が「owner なし」と判定して
      同一ユーザーが複数 owner 組織を作れる可能性があった。
      uq_one_owner_per_user（部分 UNIQUE インデックス: user_id WHERE role='owner'）を
      Alembic マイグレーション 0002 で追加し、DB レベルで重複を阻止する。
      IntegrityError の detail 文字列でインデックス違反か slug 衝突かを判別して
      適切なエラーメッセージを返す。
    """
    for attempt in range(_SLUG_MAX_RETRIES):
        slug = _generate_slug()
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
            return org
        except IntegrityError as exc:
            db.rollback()
            err_str = str(exc.orig).lower() if exc.orig else str(exc).lower()
            # owner 重複（uq_one_owner_per_user インデックス違反）か判定
            # - SQLite: "UNIQUE constraint failed: organization_members.user_id"
            # - PostgreSQL: "uq_one_owner_per_user"
            if "uq_one_owner_per_user" in err_str or (
                "organization_members.user_id" in err_str
                and "unique" in err_str
                and "organization_members.user_id, organization_members.organization_id"
                not in err_str
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="You already own an organization",
                ) from exc
            # slug 衝突の場合はリトライ（最終試行まで繰り返す）
            if attempt < _SLUG_MAX_RETRIES - 1:
                continue
            # リトライ枯渇: 5 回連続 slug 衝突は極めて稀な内部エラー
            # Minor-2 対応: 「please retry」ではなく 500 + 内部エラーメッセージを返す
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal slug generation failed",
            ) from exc

    # ここには到達しないが mypy のために明示する（全 attempt で return or raise するため）
    raise HTTPException(  # pragma: no cover
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Internal slug generation failed",
    )


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


def _delete_organization_data(db: Session, org_id: str) -> None:
    """組織に紐づく全関連データを物理削除する（個人情報保護法対応）。

    FK に ondelete="CASCADE" が設定されていないテーブルを明示的に削除する。
    削除順序は FK 依存関係に従う（子テーブルを先に削除）。

    Phase 1-8 要件:
    - 関連データ完全削除（物理削除）
    - OrganizationMember も連動削除
    - Organization 自体も物理削除（deleted_at による論理削除ではなく）
    """
    # ScheduleAssignment（schedule_periods に依存）
    db.query(ScheduleAssignmentModel).filter(
        ScheduleAssignmentModel.organization_id == org_id
    ).delete(synchronize_session=False)

    # SchedulePeriod
    db.query(SchedulePeriodModel).filter(
        SchedulePeriodModel.organization_id == org_id
    ).delete(synchronize_session=False)

    # StaffRequest
    db.query(StaffRequestModel).filter(
        StaffRequestModel.organization_id == org_id
    ).delete(synchronize_session=False)

    # StaffSkill
    db.query(StaffSkillModel).filter(StaffSkillModel.organization_id == org_id).delete(
        synchronize_session=False
    )

    # StaffingRequirement（shift_slots に依存）
    db.query(StaffingRequirementModel).filter(
        StaffingRequirementModel.organization_id == org_id
    ).delete(synchronize_session=False)

    # RoleStaffingRequirement
    db.query(RoleStaffingRequirementModel).filter(
        RoleStaffingRequirementModel.organization_id == org_id
    ).delete(synchronize_session=False)

    # SkillRequirement
    db.query(SkillRequirementModel).filter(
        SkillRequirementModel.organization_id == org_id
    ).delete(synchronize_session=False)

    # Staff（assignments / requests を先に削除済み）
    db.query(StaffModel).filter(StaffModel.organization_id == org_id).delete(
        synchronize_session=False
    )

    # ShiftSlot（requirements を先に削除済み）
    db.query(ShiftSlotModel).filter(ShiftSlotModel.organization_id == org_id).delete(
        synchronize_session=False
    )

    # SolverConfig
    db.query(SolverConfigModel).filter(
        SolverConfigModel.organization_id == org_id
    ).delete(synchronize_session=False)

    # OrganizationMember（organizations.id FK は CASCADE だが明示的に削除）
    db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id
    ).delete(synchronize_session=False)

    # Organization 本体を物理削除
    db.query(Organization).filter(Organization.id == org_id).delete(
        synchronize_session=False
    )


@router.delete(
    "/{org_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_organization(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """組織と関連データを完全削除する（個人情報保護法対応・物理削除）。

    認可:
    - 認証必須（Depends(get_current_user)）
    - 当該組織の owner Member であること（非 owner は 403）

    動作:
    - 関連する全テーブル（staff / shift_slots / requests / assignments など）を削除
    - OrganizationMember を全削除
    - Organization 自体を物理削除（deleted_at でなく DELETE）

    エラー:
    - 404: 組織が存在しない
    - 403: owner でない（または別組織の member が操作しようとした）
    - 500: DB エラー
    """
    # 組織の存在確認
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # 認可チェック: 当該組織の owner であること
    member = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.role == "owner",
        )
        .first()
    )
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the owner of this organization",
        )

    _delete_organization_data(db, org_id)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
