"""Phase 0-1: 認証・組織関連モデルの単体テスト

各モデルの基本的な CRUD、unique 制約、FK 制約、論理削除カラムを検証する。
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.models import Organization, OrganizationMember, User, VerificationToken


@pytest.fixture
def db_session():
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


# ---- User ----


def test_create_user(db_session):
    user = User(
        id="user-uuid-0001",
        email="owner@example.com",
        name="店長 太郎",
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        updated_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db_session.add(user)
    db_session.commit()

    fetched = db_session.get(User, "user-uuid-0001")
    assert fetched is not None
    assert fetched.email == "owner@example.com"
    assert fetched.deleted_at is None  # 論理削除なし


def test_user_email_unique_constraint(db_session):
    """同一 email の User を 2 件登録すると IntegrityError になる"""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db_session.add(
        User(id="u1", email="dup@example.com", created_at=now, updated_at=now)
    )
    db_session.commit()

    db_session.add(
        User(id="u2", email="dup@example.com", created_at=now, updated_at=now)
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_user_soft_delete(db_session):
    """deleted_at に値を入れると論理削除済みとして扱える"""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    user = User(id="u-del", email="del@example.com", created_at=now, updated_at=now)
    db_session.add(user)
    db_session.commit()

    user.deleted_at = now
    db_session.commit()

    fetched = db_session.get(User, "u-del")
    assert fetched.deleted_at is not None


# ---- Organization ----


def test_create_organization(db_session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    org = Organization(
        id="org-uuid-0001",
        name="マイ組織",
        slug="my-org-1234",
        created_at=now,
        updated_at=now,
    )
    db_session.add(org)
    db_session.commit()

    fetched = db_session.get(Organization, "org-uuid-0001")
    assert fetched is not None
    assert fetched.slug == "my-org-1234"
    assert fetched.deleted_at is None


def test_organization_slug_unique_constraint(db_session):
    """同一 slug の Organization を 2 件登録すると IntegrityError になる"""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db_session.add(
        Organization(
            id="o1", name="組織A", slug="same-slug", created_at=now, updated_at=now
        )
    )
    db_session.commit()

    db_session.add(
        Organization(
            id="o2", name="組織B", slug="same-slug", created_at=now, updated_at=now
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


# ---- OrganizationMember ----


def test_create_organization_member(db_session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    user = User(id="u-mem", email="mem@example.com", created_at=now, updated_at=now)
    org = Organization(
        id="o-mem", name="テスト組織", slug="test-org", created_at=now, updated_at=now
    )
    db_session.add_all([user, org])
    db_session.commit()

    member = OrganizationMember(
        organization_id="o-mem",
        user_id="u-mem",
        role="owner",
        joined_at=now,
    )
    db_session.add(member)
    db_session.commit()

    assert member.id is not None
    assert member.role == "owner"


def test_organization_member_unique_constraint(db_session):
    """同一 (user_id, organization_id) の組み合わせは 2 件目で IntegrityError"""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    user = User(id="u-dup", email="dup2@example.com", created_at=now, updated_at=now)
    org = Organization(
        id="o-dup", name="重複テスト", slug="dup-org", created_at=now, updated_at=now
    )
    db_session.add_all([user, org])
    db_session.commit()

    db_session.add(
        OrganizationMember(organization_id="o-dup", user_id="u-dup", joined_at=now)
    )
    db_session.commit()

    db_session.add(
        OrganizationMember(organization_id="o-dup", user_id="u-dup", joined_at=now)
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


# ---- VerificationToken ----


def test_create_verification_token(db_session):
    expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)
    token = VerificationToken(
        identifier="magic@example.com",
        token="hashed-token-abc123",
        expires=expires,
    )
    db_session.add(token)
    db_session.commit()

    fetched = db_session.get(
        VerificationToken,
        {"identifier": "magic@example.com", "token": "hashed-token-abc123"},
    )
    assert fetched is not None
    assert fetched.expires == expires


def test_verification_token_composite_pk(db_session):
    """同一 identifier でも token が異なれば別レコードとして登録できる"""
    expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)
    db_session.add(
        VerificationToken(
            identifier="same@example.com", token="token-aaa", expires=expires
        )
    )
    db_session.add(
        VerificationToken(
            identifier="same@example.com", token="token-bbb", expires=expires
        )
    )
    db_session.commit()

    count = (
        db_session.query(VerificationToken)
        .filter_by(identifier="same@example.com")
        .count()
    )
    assert count == 2
