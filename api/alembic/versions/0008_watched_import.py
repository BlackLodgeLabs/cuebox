"""Nullable film_watches.score, letterboxd_import source, staging + idempotency.

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-20
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop auto-named or ORM-named score/source checks from 0007 inline CHECKs.
    op.execute(
        """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN
                SELECT con.conname
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                WHERE rel.relname = 'film_watches'
                  AND con.contype = 'c'
                  AND (
                      pg_get_constraintdef(con.oid) ILIKE '%score%'
                      OR pg_get_constraintdef(con.oid) ILIKE '%source%'
                  )
            LOOP
                EXECUTE format('ALTER TABLE film_watches DROP CONSTRAINT %I', r.conname);
            END LOOP;
        END $$;
        """
    )

    # Deduplicate completed watches before unique index (keep earliest created_at).
    op.execute(
        """
        DELETE FROM film_watches a
        USING film_watches b
        WHERE a.is_pending = false
          AND b.is_pending = false
          AND a.film_id = b.film_id
          AND a.watched_at = b.watched_at
          AND a.created_at > b.created_at;
        """
    )

    op.execute(
        """
        ALTER TABLE film_watches
            ALTER COLUMN score DROP NOT NULL;

        ALTER TABLE film_watches
            ADD CONSTRAINT chk_film_watches_score_range
            CHECK (score IS NULL OR (score >= 0.5 AND score <= 5.0));

        ALTER TABLE film_watches
            ADD CONSTRAINT chk_film_watches_source
            CHECK (source IN ('manual', 'rss', 'letterboxd_import'));

        ALTER TABLE film_watches
            ADD COLUMN staged_watched_dates JSONB;

        CREATE UNIQUE INDEX uq_film_watches_film_watched_at_completed
            ON film_watches (film_id, watched_at)
            WHERE is_pending = false;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS uq_film_watches_film_watched_at_completed;

        ALTER TABLE film_watches DROP COLUMN IF EXISTS staged_watched_dates;

        ALTER TABLE film_watches DROP CONSTRAINT IF EXISTS chk_film_watches_score_range;
        ALTER TABLE film_watches DROP CONSTRAINT IF EXISTS chk_film_watches_source;

        UPDATE film_watches SET score = 0.5 WHERE score IS NULL;

        ALTER TABLE film_watches
            ALTER COLUMN score SET NOT NULL;

        ALTER TABLE film_watches
            ADD CONSTRAINT chk_film_watches_score_range
            CHECK (score >= 0.5 AND score <= 5.0);

        ALTER TABLE film_watches
            ADD CONSTRAINT chk_film_watches_source
            CHECK (source IN ('manual', 'rss'));
        """
    )
