"""Film data-access helpers."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.enums import EnrichmentStatus
from app.database.models import Film


def get_by_id(db: Session, film_id: uuid.UUID) -> Film | None:
    return db.get(Film, film_id)


def get_by_letterboxd_uri(db: Session, letterboxd_uri: str) -> Film | None:
    stmt = select(Film).where(Film.letterboxd_uri == letterboxd_uri)
    return db.scalars(stmt).first()


def list_by_enrichment_status(
    db: Session,
    status: EnrichmentStatus,
    *,
    limit: int | None = None,
) -> list[Film]:
    stmt = select(Film).where(Film.enrichment_status == status).order_by(Film.created_at)
    if limit is not None:
        stmt = stmt.limit(limit)
    return list(db.scalars(stmt).all())
