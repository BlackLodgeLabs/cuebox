"""Watchlist entry data-access helpers."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

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


def list_active_entries(db: Session) -> list[WatchlistEntry]:
    stmt = (
        select(WatchlistEntry)
        .where(WatchlistEntry.active.is_(True))
        .options(selectinload(WatchlistEntry.film))
        .order_by(WatchlistEntry.added_at)
    )
    return list(db.scalars(stmt).all())


def count_active(db: Session) -> int:
    stmt = select(func.count()).select_from(WatchlistEntry).where(WatchlistEntry.active.is_(True))
    return db.scalar(stmt) or 0


def deactivate_entry(db: Session, entry: WatchlistEntry) -> WatchlistEntry:
    entry.active = False
    entry.removed_at = datetime.now(UTC)
    db.flush()
    return entry


def get_active_by_uri(db: Session, letterboxd_uri: str) -> WatchlistEntry | None:
    stmt = (
        select(WatchlistEntry)
        .where(
            WatchlistEntry.letterboxd_uri == letterboxd_uri,
            WatchlistEntry.active.is_(True),
        )
        .options(selectinload(WatchlistEntry.film))
    )
    return db.scalars(stmt).first()
