"""Add winner_explanation_detail JSONB to recommendation_results.

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-19
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE recommendation_results
            ADD COLUMN winner_explanation_detail JSONB;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE recommendation_results
            DROP COLUMN IF EXISTS winner_explanation_detail;
        """
    )
