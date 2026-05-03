import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.auth import get_current_org_id, get_current_user
from backend.database import Base, get_db
from backend.main import app
from backend.models import Organization, OrganizationMember, User

# テスト用のデフォルト組織 ID（固定値）
TEST_ORG_ID = "test-org-uuid-0000"
TEST_ORG_SLUG = "test-org"

# テスト用ユーザー ID（固定値）
TEST_USER_ID = "test-user-uuid-0000"


def _make_stub_user() -> User:
    """テスト用スタブユーザー。

    SQLAlchemy の ORM instrumentation を回避するために MagicMock を使う。
    User 型アノテーションを満たしつつ DB アクセスを発生させない。
    """
    user = MagicMock(spec=User)
    user.id = TEST_USER_ID
    user.email = "test@example.com"
    user.name = "テストユーザー"
    user.image = None
    user.email_verified_at = None
    user.created_at = None
    user.updated_at = None
    user.deleted_at = None
    return user


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

    # Default Organization をテスト DB に作成
    org = Organization(id=TEST_ORG_ID, name="Test Organization", slug=TEST_ORG_SLUG)
    session.add(org)

    # テストユーザーを作成
    user = User(id=TEST_USER_ID, email="test@example.com")
    session.add(user)

    # OrganizationMember を作成（get_current_org_id が依存）
    member = OrganizationMember(
        organization_id=TEST_ORG_ID,
        user_id=TEST_USER_ID,
        role="owner",
    )
    session.add(member)
    session.commit()

    yield session
    session.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    # get_current_user をスタブに差し替えて既存テストが 401 にならないようにする。
    # 認証ロジックのテストは dependency_overrides を使わず実認証を通す。
    stub_user = _make_stub_user()

    def override_get_current_user():
        return stub_user

    def override_get_current_org_id():
        return TEST_ORG_ID

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_org_id] = override_get_current_org_id
    yield TestClient(app)
    app.dependency_overrides.clear()
