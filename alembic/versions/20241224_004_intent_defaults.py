"""Add intent_defaults table

Revision ID: 004_intent_defaults
Revises: 003_collections_catalog
Create Date: 2024-12-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "004_intent_defaults"
down_revision: Union[str, None] = "003_collections_catalog"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'intent_defaults',
        sa.Column('id', sa.Integer(), primary_key=True, default=1),
        sa.Column('config', JSONB(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    
    # Seed with default values
    op.execute("""
        INSERT INTO intent_defaults (id, config) VALUES (1, '{
            "speech": {
                "binning_mode": "min_max",
                "filter_amount": 0.05,
                "fallback_exponent": 0.6,
                "remove_silence": true,
                "silence_duration": 0.2
            },
            "music": {
                "binning_mode": "mean_abs",
                "filter_amount": 0.02,
                "fallback_exponent": 1.0,
                "remove_silence": false,
                "silence_duration": 0.5
            },
            "exponent_candidates": [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25]
        }')
    """)


def downgrade() -> None:
    op.drop_table('intent_defaults')