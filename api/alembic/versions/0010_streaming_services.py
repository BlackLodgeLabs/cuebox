"""Store chosen streaming services and a per-film flatrate cache.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-28
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE user_streaming_services (
            country_code    TEXT NOT NULL,
            provider_id     INTEGER NOT NULL,
            PRIMARY KEY (country_code, provider_id),
            CONSTRAINT chk_user_streaming_services_provider_id CHECK (provider_id > 0)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE film_streaming_availability (
            film_id                 UUID PRIMARY KEY REFERENCES films (id) ON DELETE CASCADE,
            country_code            TEXT NOT NULL,
            flatrate_provider_ids   INTEGER[] NOT NULL DEFAULT '{}',
            refreshed_at            TIMESTAMPTZ NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_film_streaming_availability_providers
            ON film_streaming_availability USING GIN (flatrate_provider_ids)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS film_streaming_availability")
    op.execute("DROP TABLE IF EXISTS user_streaming_services")
