"""Add sync_config table for RSS polling configuration.

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-09
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE sync_config (
            id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            rss_username                TEXT,
            configured_at               TIMESTAMPTZ,
            last_polled_at              TIMESTAMPTZ,
            last_poll_status            TEXT,
            events_processed_last_poll  INTEGER,
            created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TRIGGER trg_sync_config_updated_at
            BEFORE UPDATE ON sync_config
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS sync_config CASCADE")
