"""Add collections_catalog table

Revision ID: 003_collections_catalog
Revises: 002_ui_config
Create Date: 2024-12-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_collections_catalog"
down_revision: Union[str, None] = "002_ui_config"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'collections_catalog',
        sa.Column('id', sa.Integer(), primary_key=True, default=1),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('collections_catalog')