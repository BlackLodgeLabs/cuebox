"""Add pending_watch_review status and film_watches table.

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-17
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TYPE film_status ADD VALUE IF NOT EXISTS 'pending_watch_review';

        CREATE TABLE film_watches (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            film_id UUID NOT NULL REFERENCES films (id) ON DELETE CASCADE,
            score NUMERIC(2, 1) NOT NULL
                CHECK (score >= 0.5 AND score <= 5.0),
            watched_at DATE NOT NULL,
            notes TEXT,
            source TEXT NOT NULL CHECK (source IN ('manual', 'rss')),
            is_pending BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX idx_film_watches_film_watched_at
            ON film_watches (film_id, watched_at DESC);

        CREATE UNIQUE INDEX uq_film_watches_one_pending_per_film
            ON film_watches (film_id) WHERE is_pending = true;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS uq_film_watches_one_pending_per_film;
        DROP INDEX IF EXISTS idx_film_watches_film_watched_at;
        DROP TABLE IF EXISTS film_watches;
        """
    )
