"""add partial unique index: one owner per user

Revision ID: a1b2c3d4e5f6
Revises: bc6c46e1d93b
Create Date: 2026-05-05 00:00:00.000000

背景:
  Phase 1-1 設計書 §3.1 では「スキーマ変更なし」が方針だったが、
  Reviewer Major-1 の race condition（SELECT→INSERT 間の並行リクエストにより
  同一ユーザーが複数 owner 組織を持てる問題）を DB レベルで防ぐため、
  本マイグレーションで部分 UNIQUE インデックスのみ追加する。
  テーブル・カラム定義は変更しない。

  追加インデックス:
    uq_one_owner_per_user: organization_members.user_id WHERE role = 'owner'
    → 同一ユーザーが owner Member を 2 件 INSERT しようとすると IntegrityError が発生。
    SQLite 3.8+ および PostgreSQL 両方で部分インデックスをサポート。
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "bc6c46e1d93b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add partial unique index: one owner per user."""
    # SQLite では batch_alter_table 経由でインデックスを作成できないため、
    # 直接 DDL で実行する。部分インデックスは SQLite 3.8+ / PostgreSQL 両対応。
    op.execute(
        "CREATE UNIQUE INDEX uq_one_owner_per_user "
        "ON organization_members (user_id) "
        "WHERE role = 'owner'"
    )


def downgrade() -> None:
    """Remove partial unique index."""
    op.execute("DROP INDEX IF EXISTS uq_one_owner_per_user")
