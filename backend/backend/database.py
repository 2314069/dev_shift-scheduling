import os
from pathlib import Path

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_DEFAULT_SQLITE_URL = "sqlite:///shift_scheduling.db"
DATABASE_URL = os.environ.get("DATABASE_URL", _DEFAULT_SQLITE_URL)

_is_sqlite = DATABASE_URL.startswith("sqlite")

_connect_args = {"check_same_thread": False} if _is_sqlite else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# alembic.ini はリポジトリ内の backend/alembic.ini に配置されている
_ALEMBIC_INI_PATH = Path(__file__).resolve().parent.parent / "alembic.ini"


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def apply_migrations(engine_instance) -> None:
    """Alembic で `alembic upgrade head` を実行する。

    AUTO_MIGRATE=0 が明示された場合は何もしない（本番で deploy step として
    明示的に alembic コマンドを叩きたい運用向け）。

    Pre-Alembic な既存 DB（業務テーブルは既に存在するが alembic_version が無い）に
    対しては、初回マイグレーションを適用すると CREATE TABLE が衝突するため、
    自動的に `alembic stamp head` で「最新状態」とマークする救済を行う。
    """
    if os.environ.get("AUTO_MIGRATE", "1") != "1":
        return

    # alembic は import コストが小さくないので関数内 import
    from alembic.config import Config

    from alembic import command

    cfg = Config(str(_ALEMBIC_INI_PATH))
    cfg.set_main_option("sqlalchemy.url", str(engine_instance.url))

    insp = inspect(engine_instance)
    table_names = set(insp.get_table_names())
    has_alembic_version = "alembic_version" in table_names
    # Pre-Alembic な既存 DB を判定する代表テーブル（Phase 0-1 で必ず作られる）
    has_legacy_schema = "organizations" in table_names

    if not has_alembic_version and has_legacy_schema:
        # 既存のスキーマに alembic_version だけ追加して "最新" にマーク
        command.stamp(cfg, "head")
    else:
        command.upgrade(cfg, "head")
