"""Allow film_watches.watched_at to be null.

Manual star-tap watches can be saved without a date. Existing rows, including
Letterboxd unknown-date sentinels, are left unchanged.

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-25
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE film_watches ALTER COLUMN watched_at DROP NOT NULL")


def downgrade() -> None:
    # NOT NULL cannot be restored while null dates exist. Drop only those rows;
    # dated history, including the Letterboxd sentinel, stays as stored.
    op.execute("DELETE FROM film_watches WHERE watched_at IS NULL")
    op.execute("ALTER TABLE film_watches ALTER COLUMN watched_at SET NOT NULL")
