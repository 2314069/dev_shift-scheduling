import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_DEFAULT_SQLITE_URL = "sqlite:///shift_scheduling.db"
DATABASE_URL = os.environ.get("DATABASE_URL", _DEFAULT_SQLITE_URL)

_is_sqlite = DATABASE_URL.startswith("sqlite")

_connect_args = {"check_same_thread": False} if _is_sqlite else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _run_migrations(engine_instance):
    """既存SQLiteテーブルへのカラム追加マイグレーション（SQLiteのみ実行）。

    すべてのステップを単一トランザクションで実行し、途中で失敗した場合は
    全体ロールバックする（部分適用による不整合を防ぐ）。
    """
    if not _is_sqlite:
        return

    import uuid

    with engine_instance.begin() as conn:
        # 1. 旧カラム追加マイグレーション ---
        result = conn.execute(text("PRAGMA table_info(staff)"))
        columns = {row[1] for row in result}
        if "min_days_per_week" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE staff ADD COLUMN min_days_per_week INTEGER NOT NULL DEFAULT 0"
                )
            )

        result = conn.execute(text("PRAGMA table_info(solver_config)"))
        columns = {row[1] for row in result}
        if "enable_reverse_cycle_prohibition" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE solver_config ADD COLUMN enable_reverse_cycle_prohibition "
                    "BOOLEAN NOT NULL DEFAULT 0"
                )
            )

        result = conn.execute(text("PRAGMA table_info(solver_config)"))
        columns = {row[1] for row in result}
        if "enable_skill_staffing" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE solver_config ADD COLUMN enable_skill_staffing "
                    "BOOLEAN NOT NULL DEFAULT 0"
                )
            )

        # 2. Phase 0-1: 認証・組織関連テーブル ---
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(36) PRIMARY KEY,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    email_verified_at DATETIME,
                    name VARCHAR(100),
                    image VARCHAR(500),
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL,
                    deleted_at DATETIME
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS organizations (
                    id VARCHAR(36) PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    slug VARCHAR(50) NOT NULL UNIQUE,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL,
                    deleted_at DATETIME
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS organization_members (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    organization_id VARCHAR(36) NOT NULL
                        REFERENCES organizations(id) ON DELETE CASCADE,
                    user_id VARCHAR(36) NOT NULL
                        REFERENCES users(id) ON DELETE CASCADE,
                    role VARCHAR(20) NOT NULL DEFAULT 'owner',
                    joined_at DATETIME NOT NULL,
                    UNIQUE (user_id, organization_id)
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS verification_tokens (
                    identifier VARCHAR(255) NOT NULL,
                    token VARCHAR(255) NOT NULL,
                    expires DATETIME NOT NULL,
                    PRIMARY KEY (identifier, token)
                )
                """
            )
        )

        # 3. Default Organization（slug "default"）---
        # Phase 0-2 マイグレーション当時に既存だった業務データはすべてこの組織に集約される。
        # 既存ユーザーが存在する環境では、後続の運用タスクで適切な OrganizationMember を
        # 作成する必要がある（詳細: docs/plans/2026-04-28-operation-plan.md Phase 0-2）。
        result = conn.execute(
            text("SELECT id FROM organizations WHERE slug = 'default'")
        )
        row = result.fetchone()
        if row is None:
            default_org_id = str(uuid.uuid4())
            conn.execute(
                text(
                    "INSERT OR IGNORE INTO organizations (id, name, slug, created_at, updated_at)"
                    " VALUES (:id, :name, :slug, datetime('now'), datetime('now'))"
                ),
                {
                    "id": default_org_id,
                    "name": "Default Organization",
                    "slug": "default",
                },
            )
        else:
            default_org_id = row[0]

        # 4. 業務テーブルに organization_id を追加（Phase 0-2）---
        tables_needing_org_id = [
            "staff",
            "shift_slots",
            "schedule_periods",
            "schedule_assignments",
            "staff_requests",
            "staffing_requirements",
            "role_staffing_requirements",
            "skill_requirements",
            "staff_skills",
            "solver_config",
        ]
        for table in tables_needing_org_id:
            result = conn.execute(text(f"PRAGMA table_info({table})"))
            columns = [row[1] for row in result.fetchall()]
            if "organization_id" not in columns:
                conn.execute(
                    text(
                        f"ALTER TABLE {table} ADD COLUMN organization_id TEXT NOT NULL"
                        f" DEFAULT '{default_org_id}'"
                    )
                )
                conn.execute(
                    text(
                        f"CREATE INDEX IF NOT EXISTS idx_{table}_org"
                        f" ON {table}(organization_id)"
                    )
                )
        # `engine.begin()` が抜ける時に commit、例外時は自動 rollback。
