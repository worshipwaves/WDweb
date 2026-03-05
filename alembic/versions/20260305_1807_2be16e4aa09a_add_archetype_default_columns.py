"""add archetype default columns

Revision ID: 2be16e4aa09a
Revises: 30d1b623e073
Create Date: 2026-03-05 18:07:31.816576+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2be16e4aa09a'
down_revision: Union[str, None] = '30d1b623e073'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('archetypes', sa.Column('default_finish_x', sa.Float(), nullable=True))
    op.add_column('archetypes', sa.Column('default_finish_y', sa.Float(), nullable=True))
    op.add_column('archetypes', sa.Column('default_grain_direction', sa.String(20), nullable=True))
    op.add_column('archetypes', sa.Column('default_species', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('archetypes', 'default_species')
    op.drop_column('archetypes', 'default_grain_direction')
    op.drop_column('archetypes', 'default_finish_y')
    op.drop_column('archetypes', 'default_finish_x')