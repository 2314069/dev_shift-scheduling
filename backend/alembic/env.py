"""Alembic 環境設定。

設計方針:
- DATABASE_URL 環境変数を最優先で使う（alembic.ini の sqlalchemy.url は無視）
  → 開発: SQLite、本番: Railway PostgreSQL の両方を同一フローで扱える
- target_metadata に backend.models の Base.metadata を注入し autogenerate を有効化
- SQLite では render_as_batch=True にして ALTER TABLE 互換を確保
  （SQLite は DROP COLUMN や FK 変更などを直接サポートしないため、Alembic が
  バッチモードで一時テーブルを作って書き換える必要がある）
"""

import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from backend import models  # noqa: F401, E402  -- メタデータ登録のため副作用 import

# プロジェクトモデルをインポート（Base.metadata 解決のため）
from backend.database import Base  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# DATABASE_URL を優先（alembic.ini の値は使わない）
_db_url = os.environ.get("DATABASE_URL")
if _db_url:
    config.set_main_option("sqlalchemy.url", _db_url)

target_metadata = Base.metadata


def _is_sqlite_url(url: str | None) -> bool:
    return bool(url and url.startswith("sqlite"))


def run_migrations_offline() -> None:
    """`alembic upgrade --sql` 用のオフラインモード。"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=_is_sqlite_url(url),
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """通常の `alembic upgrade head` などで使われるオンラインモード。"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=connection.dialect.name == "sqlite",
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
