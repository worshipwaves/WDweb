"""Add filter_candidates to intent_defaults

Revision ID: 005_intent_filter_candidates
Revises: 004_intent_defaults
Create Date: 2024-12-25
"""
from typing import Sequence, Union

from alembic import op

revision: str = "005_intent_filter_candidates"
down_revision: Union[str, None] = "004_intent_defaults"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE intent_defaults SET config = '{
            "speech": {
                "binning_mode": "min_max",
                "filter_candidates": [0.03, 0.05, 0.07],
                "fallback_filter": 0.05,
                "fallback_exponent": 0.6,
                "exponent_candidates": [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25],
                "remove_silence": true,
                "silence_duration": 0.2
            },
            "music": {
                "binning_mode": "mean_abs",
                "filter_candidates": [0.01, 0.02, 0.03],
                "fallback_filter": 0.02,
                "fallback_exponent": 1.0,
                "exponent_candidates": [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25],
                "remove_silence": false,
                "silence_duration": 0.5
            }
        }' WHERE id = 1
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE intent_defaults SET config = '{
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
        }' WHERE id = 1
    """)