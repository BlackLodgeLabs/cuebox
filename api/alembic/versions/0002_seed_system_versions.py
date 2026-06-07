"""Seed active system version records.

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-07
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SEED_VERSIONS = (
    ("semantic", "semantic-profile", "semantic-v1"),
    ("embedding", "film-embedding", "embedding-v1"),
    ("scoring", "recommendation", "scoring-v1"),
    ("prompt", "ranking-prompt", "recommendation-v1"),
)


def upgrade() -> None:
    for artifact_type, artifact_name, version in _SEED_VERSIONS:
        op.execute(
            f"""
            INSERT INTO system_versions (artifact_type, artifact_name, version, active)
            VALUES ('{artifact_type}', '{artifact_name}', '{version}', TRUE)
            """
        )


def downgrade() -> None:
    versions = ", ".join(f"'{version}'" for _, _, version in _SEED_VERSIONS)
    op.execute(f"DELETE FROM system_versions WHERE version IN ({versions})")
