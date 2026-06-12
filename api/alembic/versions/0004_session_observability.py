"""Add observability columns to recommendation_sessions.

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-12
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE recommendation_sessions
            ADD COLUMN tokens_input INTEGER,
            ADD COLUMN tokens_output INTEGER,
            ADD COLUMN profile_cache_hit BOOLEAN NOT NULL DEFAULT FALSE;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE recommendation_sessions
            DROP COLUMN IF EXISTS tokens_input,
            DROP COLUMN IF EXISTS tokens_output,
            DROP COLUMN IF EXISTS profile_cache_hit;
        """
    )
