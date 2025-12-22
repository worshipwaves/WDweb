"""Add ui_config table

Revision ID: 002_ui_config
Revises: 001_initial
Create Date: 2024-12-21

Migrates ui_config.json to database.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002_ui_config"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ui_config",
        sa.Column("id", sa.Integer, primary_key=True, default=1),
        sa.Column("elements", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("buttons", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("upload", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("thumbnail_config", postgresql.JSONB, server_default="{}"),
        sa.Column("categories", postgresql.JSONB, server_default="{}"),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("ui_config")