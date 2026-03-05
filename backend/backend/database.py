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
    """既存SQLiteテーブルへのカラム追加マイグレーション（SQLiteのみ実行）"""
    if not _is_sqlite:
        return
    with engine_instance.connect() as conn:
        # staff テーブルに min_days_per_week カラムがなければ追加
        result = conn.execute(text("PRAGMA table_info(staff)"))
        columns = {row[1] for row in result}
        if "min_days_per_week" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE staff ADD COLUMN min_days_per_week INTEGER NOT NULL DEFAULT 0"
                )
            )
            conn.commit()

        # solver_config に enable_reverse_cycle_prohibition がなければ追加
        result = conn.execute(text("PRAGMA table_info(solver_config)"))
        columns = {row[1] for row in result}
        if "enable_reverse_cycle_prohibition" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE solver_config ADD COLUMN enable_reverse_cycle_prohibition "
                    "BOOLEAN NOT NULL DEFAULT 0"
                )
            )
            conn.commit()

        # solver_config に enable_skill_staffing がなければ追加
        result = conn.execute(text("PRAGMA table_info(solver_config)"))
        columns = {row[1] for row in result}
        if "enable_skill_staffing" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE solver_config ADD COLUMN enable_skill_staffing "
                    "BOOLEAN NOT NULL DEFAULT 0"
                )
            )
            conn.commit()
