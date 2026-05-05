"""Phase 1-8: 退会・データ削除フロー の単体テスト。

テスト対象:
- DELETE /api/organizations/{org_id}: 組織削除 API
- DELETE /api/me: アカウント削除 API

テスト方針:
- 各テストは独立したインメモリ SQLite を使用（テスト間の干渉なし）
- E2E バイパスユーザーは使わず、専用の fixture ユーザーで検証する
- テナント分離: 他組織のデータが影響を受けないことを確認
"""

import uuid
from datetime import time
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

# テスト用固定値
TEST_USER_ID = "deletion-test-user-0001"
TEST_USER_ID_2 = "deletion-test-user-0002"
TEST_ORG_ID = "deletion-test-org-0001"
TEST_ORG_ID_2 = "deletion-test-org-0002"


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
    """テスト用スタブユーザー（MagicMock で DB アクセスを回避）。"""
    user = MagicMock(spec=User)
    user.id = user_id
    user.email = f"{user_id}@example.com"
    user.name = "テストユーザー"
    user.image = None
    user.email_verified_at = None
    user.created_at = None
    user.updated_at = None
    user.deleted_at = None
    return user


@pytest.fixture
def auth_client(db_session):
    """認証済みクライアント（TEST_USER_ID のスタブユーザーで認証）。"""

    def override_get_db():
        yield db_session

    stub_user = _make_stub_user(TEST_USER_ID)

    def override_get_current_user():
        return stub_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def unauth_client(db_session, monkeypatch):
    """認証なしクライアント（dependency_overrides を使わない）。"""
    monkeypatch.setenv("AUTH_SECRET", "test-secret-for-401-check")

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# テストヘルパー
# ---------------------------------------------------------------------------


def _create_user(db_session, user_id: str, email: str) -> User:
    """テスト用ユーザーを DB に作成して返す。"""
    user = User(id=user_id, email=email)
    db_session.add(user)
    db_session.commit()
    return user


def _create_org(
    db_session,
    org_id: str = TEST_ORG_ID,
    name: str = "テスト組織",
    slug: str | None = None,
) -> Organization:
    """テスト用 Organization を DB に作成して返す。"""
    org = Organization(
        id=org_id,
        name=name,
        slug=slug or uuid.uuid4().hex[:12],
    )
    db_session.add(org)
    db_session.commit()
    return org


def _create_member(
    db_session,
    user_id: str,
    org_id: str,
    role: str = "owner",
) -> OrganizationMember:
    """テスト用 OrganizationMember を DB に作成して返す。"""
    member = OrganizationMember(
        user_id=user_id,
        organization_id=org_id,
        role=role,
    )
    db_session.add(member)
    db_session.commit()
    return member


def _create_full_org_data(db_session, org_id: str) -> dict:
    """組織に紐づく全種類の関連データを作成して返す。

    削除後の完全消滅を確認するために使用する。
    """
    # Staff
    staff = StaffModel(
        organization_id=org_id,
        name="スタッフ太郎",
        role="staff",
    )
    db_session.add(staff)
    db_session.flush()

    # ShiftSlot
    slot = ShiftSlotModel(
        organization_id=org_id,
        name="早番",
        start_time=time(9, 0),
        end_time=time(17, 0),
    )
    db_session.add(slot)
    db_session.flush()

    # SchedulePeriod
    from datetime import date

    period = SchedulePeriodModel(
        organization_id=org_id,
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 31),
        status="draft",
    )
    db_session.add(period)
    db_session.flush()

    # ScheduleAssignment
    assignment = ScheduleAssignmentModel(
        organization_id=org_id,
        period_id=period.id,
        staff_id=staff.id,
        date=date(2026, 5, 10),
        shift_slot_id=slot.id,
    )
    db_session.add(assignment)

    # StaffRequest
    request = StaffRequestModel(
        organization_id=org_id,
        staff_id=staff.id,
        date=date(2026, 5, 15),
        type="preferred",
    )
    db_session.add(request)

    # StaffingRequirement
    req = StaffingRequirementModel(
        organization_id=org_id,
        shift_slot_id=slot.id,
        day_type="weekday",
        min_count=2,
    )
    db_session.add(req)

    # RoleStaffingRequirement
    role_req = RoleStaffingRequirementModel(
        organization_id=org_id,
        shift_slot_id=slot.id,
        day_type="weekday",
        role="manager",
        min_count=1,
    )
    db_session.add(role_req)

    # SkillRequirement
    skill_req = SkillRequirementModel(
        organization_id=org_id,
        shift_slot_id=slot.id,
        day_type="weekday",
        skill="調理",
        min_count=1,
    )
    db_session.add(skill_req)

    # StaffSkill
    staff_skill = StaffSkillModel(
        organization_id=org_id,
        staff_id=staff.id,
        skill="調理",
    )
    db_session.add(staff_skill)

    # SolverConfig
    solver = SolverConfigModel(
        organization_id=org_id,
    )
    db_session.add(solver)

    db_session.commit()

    return {
        "staff_id": staff.id,
        "slot_id": slot.id,
        "period_id": period.id,
        "assignment_id": assignment.id,
        "request_id": request.id,
        "staffing_req_id": req.id,
        "role_req_id": role_req.id,
        "skill_req_id": skill_req.id,
        "staff_skill_id": staff_skill.id,
        "solver_id": solver.id,
    }


def _assert_org_data_deleted(db_session, org_id: str, data: dict) -> None:
    """組織に紐づく全関連データが物理削除されていることを確認する。"""
    assert (
        db_session.query(Organization).filter(Organization.id == org_id).first() is None
    )
    assert (
        db_session.query(OrganizationMember)
        .filter(OrganizationMember.organization_id == org_id)
        .count()
        == 0
    )
    assert (
        db_session.query(StaffModel).filter(StaffModel.id == data["staff_id"]).first()
        is None
    )
    assert (
        db_session.query(ShiftSlotModel)
        .filter(ShiftSlotModel.id == data["slot_id"])
        .first()
        is None
    )
    assert (
        db_session.query(SchedulePeriodModel)
        .filter(SchedulePeriodModel.id == data["period_id"])
        .first()
        is None
    )
    assert (
        db_session.query(ScheduleAssignmentModel)
        .filter(ScheduleAssignmentModel.id == data["assignment_id"])
        .first()
        is None
    )
    assert (
        db_session.query(StaffRequestModel)
        .filter(StaffRequestModel.id == data["request_id"])
        .first()
        is None
    )
    assert (
        db_session.query(StaffingRequirementModel)
        .filter(StaffingRequirementModel.id == data["staffing_req_id"])
        .first()
        is None
    )
    assert (
        db_session.query(RoleStaffingRequirementModel)
        .filter(RoleStaffingRequirementModel.id == data["role_req_id"])
        .first()
        is None
    )
    assert (
        db_session.query(SkillRequirementModel)
        .filter(SkillRequirementModel.id == data["skill_req_id"])
        .first()
        is None
    )
    assert (
        db_session.query(StaffSkillModel)
        .filter(StaffSkillModel.id == data["staff_skill_id"])
        .first()
        is None
    )
    assert (
        db_session.query(SolverConfigModel)
        .filter(SolverConfigModel.id == data["solver_id"])
        .first()
        is None
    )


# ===========================================================================
# DELETE /api/organizations/{org_id} テスト
# ===========================================================================


class TestDeleteOrganizationUnauthenticated:
    """認証なし → 401"""

    def test_returns_401_without_auth(self, unauth_client: TestClient) -> None:
        """認証なしで 401 が返ること。"""
        response = unauth_client.delete(f"/api/organizations/{TEST_ORG_ID}")
        assert response.status_code == 401


class TestDeleteOrganizationNotFound:
    """存在しない組織 → 404"""

    def test_returns_404_for_nonexistent_org(
        self, auth_client: TestClient, db_session
    ) -> None:
        """存在しない組織 ID で 404 が返ること。"""
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        response = auth_client.delete("/api/organizations/nonexistent-org-id")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestDeleteOrganizationForbidden:
    """非 owner ユーザー → 403"""

    def test_returns_403_when_not_owner(
        self, auth_client: TestClient, db_session
    ) -> None:
        """owner でないユーザー（member ロール）が操作すると 403 が返ること。"""
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        _create_org(db_session, TEST_ORG_ID)
        # TEST_USER_ID は owner ではなく member
        _create_member(db_session, TEST_USER_ID, TEST_ORG_ID, role="member")

        response = auth_client.delete(f"/api/organizations/{TEST_ORG_ID}")
        assert response.status_code == 403
        assert "owner" in response.json()["detail"].lower()

    def test_returns_403_when_not_member_at_all(
        self, auth_client: TestClient, db_session
    ) -> None:
        """組織のメンバーでもないユーザーが操作すると 403 が返ること。"""
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        # 別ユーザーの組織を作成
        other_user_id = "other-user-for-403-test"
        _create_user(db_session, other_user_id, "other@example.com")
        _create_org(db_session, TEST_ORG_ID)
        _create_member(db_session, other_user_id, TEST_ORG_ID, role="owner")

        # TEST_USER_ID は TEST_ORG_ID のメンバーではない
        response = auth_client.delete(f"/api/organizations/{TEST_ORG_ID}")
        assert response.status_code == 403


class TestDeleteOrganizationSuccess:
    """正常系: 204 + 全関連データ削除"""

    def test_returns_204_on_success(self, auth_client: TestClient, db_session) -> None:
        """正常削除で 204 が返ること。"""
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        _create_org(db_session, TEST_ORG_ID)
        _create_member(db_session, TEST_USER_ID, TEST_ORG_ID, role="owner")

        response = auth_client.delete(f"/api/organizations/{TEST_ORG_ID}")
        assert response.status_code == 204

    def test_organization_physically_deleted(
        self, auth_client: TestClient, db_session
    ) -> None:
        """Organization レコードが物理削除されること（deleted_at でなく DELETE）。"""
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        _create_org(db_session, TEST_ORG_ID)
        _create_member(db_session, TEST_USER_ID, TEST_ORG_ID, role="owner")

        auth_client.delete(f"/api/organizations/{TEST_ORG_ID}")

        org = (
            db_session.query(Organization)
            .filter(Organization.id == TEST_ORG_ID)
            .first()
        )
        assert org is None

    def test_all_related_data_deleted(
        self, auth_client: TestClient, db_session
    ) -> None:
        """全関連データ（staff / slots / periods / assignments / requests /
        requirements / skills / solver_config）が完全削除されること。"""
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        _create_org(db_session, TEST_ORG_ID)
        _create_member(db_session, TEST_USER_ID, TEST_ORG_ID, role="owner")
        data = _create_full_org_data(db_session, TEST_ORG_ID)

        response = auth_client.delete(f"/api/organizations/{TEST_ORG_ID}")
        assert response.status_code == 204

        # セッションキャッシュをクリアして DB を再読み込みする
        db_session.expire_all()

        _assert_org_data_deleted(db_session, TEST_ORG_ID, data)

    def test_org_members_deleted(self, auth_client: TestClient, db_session) -> None:
        """OrganizationMember レコードも削除されること。"""
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        _create_org(db_session, TEST_ORG_ID)
        _create_member(db_session, TEST_USER_ID, TEST_ORG_ID, role="owner")

        auth_client.delete(f"/api/organizations/{TEST_ORG_ID}")
        db_session.expire_all()

        count = (
            db_session.query(OrganizationMember)
            .filter(OrganizationMember.organization_id == TEST_ORG_ID)
            .count()
        )
        assert count == 0


class TestDeleteOrganizationTenantIsolation:
    """テナント分離: 他組織データが影響を受けないこと"""

    def test_other_org_data_not_affected(
        self, auth_client: TestClient, db_session
    ) -> None:
        """自組織を削除しても、他組織のデータが残ること。"""
        # ユーザーA: TEST_USER_ID（auth_client の認証ユーザー）
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        _create_org(db_session, TEST_ORG_ID, name="削除対象店舗")
        _create_member(db_session, TEST_USER_ID, TEST_ORG_ID, role="owner")
        _create_full_org_data(db_session, TEST_ORG_ID)

        # ユーザーB: 別組織を持つ
        other_user_id = "other-tenant-user"
        _create_user(db_session, other_user_id, "other@example.com")
        _create_org(db_session, TEST_ORG_ID_2, name="他の店舗")
        _create_member(db_session, other_user_id, TEST_ORG_ID_2, role="owner")
        other_data = _create_full_org_data(db_session, TEST_ORG_ID_2)

        # 自組織を削除
        response = auth_client.delete(f"/api/organizations/{TEST_ORG_ID}")
        assert response.status_code == 204

        db_session.expire_all()

        # 他組織は削除されていないこと
        other_org = (
            db_session.query(Organization)
            .filter(Organization.id == TEST_ORG_ID_2)
            .first()
        )
        assert other_org is not None
        assert other_org.name == "他の店舗"

        # 他組織のスタッフも残っていること
        other_staff = (
            db_session.query(StaffModel)
            .filter(StaffModel.id == other_data["staff_id"])
            .first()
        )
        assert other_staff is not None


# ===========================================================================
# DELETE /api/me テスト
# ===========================================================================


class TestDeleteMeUnauthenticated:
    """認証なし → 401"""

    def test_returns_401_without_auth(self, unauth_client: TestClient) -> None:
        """認証なしで 401 が返ること。"""
        response = unauth_client.delete("/api/me")
        assert response.status_code == 401


class TestDeleteMeSuccess:
    """正常系: 204 + User / 組織 / 全関連データ削除"""

    def test_returns_204_on_success(self, auth_client: TestClient, db_session) -> None:
        """正常削除で 204 が返ること。"""
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        _create_org(db_session, TEST_ORG_ID)
        _create_member(db_session, TEST_USER_ID, TEST_ORG_ID, role="owner")

        response = auth_client.delete("/api/me")
        assert response.status_code == 204

    def test_user_physically_deleted(self, auth_client: TestClient, db_session) -> None:
        """User レコードが物理削除されること（deleted_at でなく DELETE）。"""
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        _create_org(db_session, TEST_ORG_ID)
        _create_member(db_session, TEST_USER_ID, TEST_ORG_ID, role="owner")

        auth_client.delete("/api/me")
        db_session.expire_all()

        user = db_session.query(User).filter(User.id == TEST_USER_ID).first()
        assert user is None

    def test_owner_org_and_all_data_deleted(
        self, auth_client: TestClient, db_session
    ) -> None:
        """owner 組織とその全関連データが削除されること。"""
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        _create_org(db_session, TEST_ORG_ID)
        _create_member(db_session, TEST_USER_ID, TEST_ORG_ID, role="owner")
        data = _create_full_org_data(db_session, TEST_ORG_ID)

        response = auth_client.delete("/api/me")
        assert response.status_code == 204

        db_session.expire_all()

        _assert_org_data_deleted(db_session, TEST_ORG_ID, data)

    def test_member_memberships_deleted(
        self, auth_client: TestClient, db_session
    ) -> None:
        """非 owner としての OrganizationMember も削除されること。"""
        # 別ユーザーの組織に member として所属しているケース
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        other_user_id = "other-owner-for-me-delete"
        _create_user(db_session, other_user_id, "other@example.com")
        _create_org(db_session, TEST_ORG_ID_2, name="他ユーザーの店舗")
        _create_member(db_session, other_user_id, TEST_ORG_ID_2, role="owner")
        # TEST_USER_ID を非 owner member として追加
        _create_member(db_session, TEST_USER_ID, TEST_ORG_ID_2, role="member")

        response = auth_client.delete("/api/me")
        assert response.status_code == 204

        db_session.expire_all()

        # TEST_USER_ID の member レコードは削除されている
        count = (
            db_session.query(OrganizationMember)
            .filter(OrganizationMember.user_id == TEST_USER_ID)
            .count()
        )
        assert count == 0

    def test_user_without_org_deleted(
        self, auth_client: TestClient, db_session
    ) -> None:
        """組織未所属のユーザーも削除できること。"""
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")

        response = auth_client.delete("/api/me")
        assert response.status_code == 204

        db_session.expire_all()

        user = db_session.query(User).filter(User.id == TEST_USER_ID).first()
        assert user is None


class TestDeleteMeTenantIsolation:
    """テナント分離: 他ユーザーのデータが影響を受けないこと"""

    def test_other_user_org_not_affected(
        self, auth_client: TestClient, db_session
    ) -> None:
        """自アカウントを削除しても、他ユーザーの組織とデータが残ること。"""
        # 削除対象ユーザー（auth_client の認証ユーザー）
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")
        _create_org(db_session, TEST_ORG_ID, name="削除対象店舗")
        _create_member(db_session, TEST_USER_ID, TEST_ORG_ID, role="owner")
        _create_full_org_data(db_session, TEST_ORG_ID)

        # 別ユーザーとその組織
        other_user_id = "other-user-isolation-check"
        _create_user(db_session, other_user_id, "other@example.com")
        _create_org(db_session, TEST_ORG_ID_2, name="他の店舗")
        _create_member(db_session, other_user_id, TEST_ORG_ID_2, role="owner")
        other_data = _create_full_org_data(db_session, TEST_ORG_ID_2)

        # 自アカウントを削除
        response = auth_client.delete("/api/me")
        assert response.status_code == 204

        db_session.expire_all()

        # 他ユーザーは削除されていないこと
        other_user = db_session.query(User).filter(User.id == other_user_id).first()
        assert other_user is not None

        # 他ユーザーの組織も残っていること
        other_org = (
            db_session.query(Organization)
            .filter(Organization.id == TEST_ORG_ID_2)
            .first()
        )
        assert other_org is not None
        assert other_org.name == "他の店舗"

        # 他組織の全データも残っていること
        other_staff = (
            db_session.query(StaffModel)
            .filter(StaffModel.id == other_data["staff_id"])
            .first()
        )
        assert other_staff is not None

    def test_other_org_member_record_preserved(
        self, auth_client: TestClient, db_session
    ) -> None:
        """他ユーザーの OrganizationMember が削除されないこと。"""
        # 自ユーザー（削除対象）
        _create_user(db_session, TEST_USER_ID, f"{TEST_USER_ID}@example.com")

        # 他ユーザーが別組織の owner
        other_user_id = "other-user-member-check"
        _create_user(db_session, other_user_id, "other-member@example.com")
        _create_org(db_session, TEST_ORG_ID_2, name="他の店舗")
        _create_member(db_session, other_user_id, TEST_ORG_ID_2, role="owner")

        # 自ユーザーを削除
        response = auth_client.delete("/api/me")
        assert response.status_code == 204

        db_session.expire_all()

        # 他ユーザーの member レコードは残っていること
        other_member = (
            db_session.query(OrganizationMember)
            .filter(OrganizationMember.user_id == other_user_id)
            .first()
        )
        assert other_member is not None
        assert other_member.role == "owner"
