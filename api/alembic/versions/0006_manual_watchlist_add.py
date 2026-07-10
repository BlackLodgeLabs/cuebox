"""Add manual watchlist add columns.

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-09
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE films
            ADD COLUMN add_source TEXT NULL
                CHECK (add_source IS NULL OR add_source = 'manual');

        ALTER TABLE metadata_match_reviews
            ADD COLUMN review_type TEXT NOT NULL DEFAULT 'tmdb_match'
                CHECK (review_type IN ('tmdb_match', 'letterboxd_uri'));
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE metadata_match_reviews
            DROP COLUMN IF EXISTS review_type;

        ALTER TABLE films
            DROP COLUMN IF EXISTS add_source;
        """
    )
