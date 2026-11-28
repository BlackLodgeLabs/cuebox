"""Chosen streaming services and the per-film flatrate cache."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.database.models import (
    Film,
    FilmMetadata,
    FilmStreamingAvailability,
    UserStreamingService,
    WatchlistEntry,
)


def list_provider_ids(db: Session, country_code: str) -> list[int]:
    stmt = (
        select(UserStreamingService.provider_id)
        .where(UserStreamingService.country_code == country_code)
        .order_by(UserStreamingService.provider_id)
    )
    return list(db.scalars(stmt).all())


def replace_provider_ids(db: Session, country_code: str, provider_ids: list[int]) -> list[int]:
    """Replace the country's selection. Ids are stored unique and ascending."""
    unique = sorted(set(provider_ids))
    db.execute(
        delete(UserStreamingService).where(UserStreamingService.country_code == country_code)
    )
    for provider_id in unique:
        db.add(UserStreamingService(country_code=country_code, provider_id=provider_id))
    db.flush()
    return unique


def get_availability(db: Session, film_id: uuid.UUID) -> FilmStreamingAvailability | None:
    return db.get(FilmStreamingAvailability, film_id)


def is_stale(
    db: Session,
    film_id: uuid.UUID,
    *,
    country_code: str,
    max_age: timedelta,
    now: datetime | None = None,
) -> bool:
    row = get_availability(db, film_id)
    if row is None or row.country_code != country_code:
        return True
    refreshed = row.refreshed_at
    if refreshed.tzinfo is None:
        refreshed = refreshed.replace(tzinfo=UTC)
    moment = now or datetime.now(UTC)
    return refreshed < moment - max_age


def list_watchlist_films_to_refresh(
    db: Session,
    *,
    country_code: str,
    older_than: datetime,
) -> list[tuple[uuid.UUID, int]]:
    """Active watchlist films whose flatrate cache is missing, foreign, or old."""
    stmt = (
        select(Film.id, FilmMetadata.tmdb_id)
        .join(
            WatchlistEntry,
            (WatchlistEntry.film_id == Film.id) & WatchlistEntry.active.is_(True),
        )
        .join(FilmMetadata, FilmMetadata.film_id == Film.id)
        .outerjoin(
            FilmStreamingAvailability,
            FilmStreamingAvailability.film_id == Film.id,
        )
        .where(FilmMetadata.tmdb_id.is_not(None))
        .where(
            or_(
                FilmStreamingAvailability.film_id.is_(None),
                FilmStreamingAvailability.country_code != country_code,
                FilmStreamingAvailability.refreshed_at < older_than,
            )
        )
    )
    rows: list[tuple[uuid.UUID, int]] = []
    for film_id, tmdb_id in db.execute(stmt).all():
        if tmdb_id is None:
            continue
        rows.append((film_id, int(tmdb_id)))
    return rows


def upsert_flatrate(
    db: Session,
    film_id: uuid.UUID,
    *,
    country_code: str,
    provider_ids: list[int],
    refreshed_at: datetime | None = None,
) -> FilmStreamingAvailability:
    unique = sorted(set(provider_ids))
    row = get_availability(db, film_id)
    moment = refreshed_at or datetime.now(UTC)
    if row is None:
        row = FilmStreamingAvailability(
            film_id=film_id,
            country_code=country_code,
            flatrate_provider_ids=unique,
            refreshed_at=moment,
        )
        db.add(row)
    else:
        row.country_code = country_code
        row.flatrate_provider_ids = unique
        row.refreshed_at = moment
    db.flush()
    return row
