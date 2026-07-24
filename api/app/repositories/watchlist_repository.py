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


def get_latest_removed_at(db: Session, film_id: uuid.UUID) -> datetime | None:
    stmt = (
        select(WatchlistEntry.removed_at)
        .where(
            WatchlistEntry.film_id == film_id,
            WatchlistEntry.active.is_(False),
            WatchlistEntry.removed_at.isnot(None),
        )
        .order_by(WatchlistEntry.removed_at.desc())
        .limit(1)
    )
    return db.scalar(stmt)


def get_latest_removed_at_batch(
    db: Session,
    film_ids: list[uuid.UUID],
) -> dict[uuid.UUID, datetime]:
    if not film_ids:
        return {}

    stmt = (
        select(WatchlistEntry.film_id, WatchlistEntry.removed_at)
        .where(
            WatchlistEntry.film_id.in_(film_ids),
            WatchlistEntry.active.is_(False),
            WatchlistEntry.removed_at.isnot(None),
        )
        .order_by(WatchlistEntry.film_id, WatchlistEntry.removed_at.desc())
        .distinct(WatchlistEntry.film_id)
    )
    return {row[0]: row[1] for row in db.execute(stmt).all()}


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


def has_any_entry_for_film(db: Session, film_id: uuid.UUID) -> bool:
    stmt = select(func.count()).select_from(WatchlistEntry).where(
        WatchlistEntry.film_id == film_id
    )
    return (db.scalar(stmt) or 0) > 0
