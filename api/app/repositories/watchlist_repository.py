"""Watchlist entry data-access helpers."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import WatchlistEntry


def get_active_by_film_id(db: Session, film_id: uuid.UUID) -> WatchlistEntry | None:
    stmt = select(WatchlistEntry).where(
        WatchlistEntry.film_id == film_id,
        WatchlistEntry.active.is_(True),
    )
    return db.scalars(stmt).first()


def create_active_entry(
    db: Session,
    *,
    film_id: uuid.UUID,
    letterboxd_uri: str,
) -> WatchlistEntry:
    entry = WatchlistEntry(film_id=film_id, letterboxd_uri=letterboxd_uri, active=True)
    db.add(entry)
    db.flush()
    return entry


def ensure_active_entry(
    db: Session,
    *,
    film_id: uuid.UUID,
    letterboxd_uri: str,
) -> WatchlistEntry:
    existing = get_active_by_film_id(db, film_id)
    if existing is not None:
        return existing
    return create_active_entry(db, film_id=film_id, letterboxd_uri=letterboxd_uri)
