"""System version registry data-access helpers."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.enums import ArtifactType
from app.database.models import SystemVersion


def get_active_by_artifact_type(db: Session, artifact_type: ArtifactType) -> list[SystemVersion]:
    stmt = (
        select(SystemVersion)
        .where(SystemVersion.artifact_type == artifact_type, SystemVersion.active.is_(True))
        .order_by(SystemVersion.created_at.desc())
    )
    return list(db.scalars(stmt).all())


def get_active_version(db: Session, artifact_name: str) -> SystemVersion | None:
    stmt = (
        select(SystemVersion)
        .where(
            SystemVersion.artifact_name == artifact_name,
            SystemVersion.active.is_(True),
        )
        .order_by(SystemVersion.created_at.desc())
        .limit(1)
    )
    return db.scalars(stmt).first()
