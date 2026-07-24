"""Film watch record data-access helpers."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.enums import FilmStatus, WatchSource
from app.database.models import Film, FilmWatch


def create_pending(
    db: Session,
    *,
    film_id: uuid.UUID,
    source: WatchSource,
    watched_at: date,
    score: float | Decimal | None = None,
    staged_watched_dates: list[str] | None = None,
) -> FilmWatch:
    watch = FilmWatch(
        film_id=film_id,
        source=source,
        watched_at=watched_at,
        score=Decimal(str(score)) if score is not None else None,
        is_pending=True,
        staged_watched_dates=staged_watched_dates,
    )
    db.add(watch)
    db.flush()
    return watch


def create_completed(
    db: Session,
    *,
    film_id: uuid.UUID,
    source: WatchSource,
    watched_at: date,
    score: float | Decimal | None = None,
    notes: str | None = None,
) -> FilmWatch:
    watch = FilmWatch(
        film_id=film_id,
        source=source,
        watched_at=watched_at,
        score=Decimal(str(score)) if score is not None else None,
        notes=notes,
        is_pending=False,
        staged_watched_dates=None,
    )
    db.add(watch)
    db.flush()
    return watch


def get_completed_by_film_and_date(
    db: Session,
    film_id: uuid.UUID,
    watched_at: date,
) -> FilmWatch | None:
    stmt = select(FilmWatch).where(
        FilmWatch.film_id == film_id,
        FilmWatch.watched_at == watched_at,
        FilmWatch.is_pending.is_(False),
    )
    return db.scalars(stmt).first()


def get_pending_for_film(db: Session, film_id: uuid.UUID) -> FilmWatch | None:
    stmt = select(FilmWatch).where(
        FilmWatch.film_id == film_id,
        FilmWatch.is_pending.is_(True),
    )
    return db.scalars(stmt).first()


def finalize_pending(
    db: Session,
    watch: FilmWatch,
    *,
    score: float | Decimal,
    watched_at: date,
    notes: str | None = None,
) -> FilmWatch:
    watch.score = Decimal(str(score))
    watch.watched_at = watched_at
    watch.notes = notes
    watch.is_pending = False
    watch.staged_watched_dates = None
    db.flush()
    return watch


def delete_pending_for_film(db: Session, film_id: uuid.UUID) -> None:
    pending = get_pending_for_film(db, film_id)
    if pending is not None:
        db.delete(pending)
        db.flush()


def list_for_film(db: Session, film_id: uuid.UUID) -> list[FilmWatch]:
    stmt = (
        select(FilmWatch)
        .where(FilmWatch.film_id == film_id, FilmWatch.is_pending.is_(False))
        .order_by(FilmWatch.watched_at.desc(), FilmWatch.created_at.desc())
    )
    return list(db.scalars(stmt).all())


def list_all_for_film(db: Session, film_id: uuid.UUID) -> list[FilmWatch]:
    stmt = (
        select(FilmWatch)
        .where(FilmWatch.film_id == film_id)
        .order_by(FilmWatch.watched_at.desc(), FilmWatch.created_at.desc())
    )
    return list(db.scalars(stmt).all())


def get_by_id(db: Session, watch_id: uuid.UUID) -> FilmWatch | None:
    return db.get(FilmWatch, watch_id)


def update_watch(
    db: Session,
    watch: FilmWatch,
    *,
    score: float | Decimal,
    watched_at: date,
    notes: str | None = None,
) -> FilmWatch:
    watch.score = Decimal(str(score))
    watch.watched_at = watched_at
    watch.notes = notes
    db.flush()
    return watch


def list_pending_watch_reviews(
    db: Session,
    *,
    limit: int,
    offset: int,
) -> tuple[list[tuple[Film, FilmWatch]], int]:
    conditions = (
        Film.status == FilmStatus.PENDING_WATCH_REVIEW,
        FilmWatch.is_pending.is_(True),
    )
    total = (
        db.scalar(
            select(func.count(FilmWatch.id))
            .join(Film, Film.id == FilmWatch.film_id)
            .where(*conditions)
        )
        or 0
    )
    stmt = (
        select(Film, FilmWatch)
        .join(FilmWatch, FilmWatch.film_id == Film.id)
        .where(*conditions)
        .order_by(FilmWatch.created_at)
        .limit(limit)
        .offset(offset)
    )
    rows = db.execute(stmt).all()
    return list(rows), total


def count_pending_watch_reviews(db: Session) -> int:
    return (
        db.scalar(
            select(func.count(FilmWatch.id))
            .join(Film, Film.id == FilmWatch.film_id)
            .where(
                Film.status == FilmStatus.PENDING_WATCH_REVIEW,
                FilmWatch.is_pending.is_(True),
            )
        )
        or 0
    )


def update_pending_prefill(
    db: Session,
    watch: FilmWatch,
    *,
    watched_at: date,
    score: float | Decimal | None = None,
    staged_watched_dates: list[str] | None = None,
) -> FilmWatch:
    watch.watched_at = watched_at
    if score is not None:
        watch.score = Decimal(str(score))
    if staged_watched_dates is not None:
        watch.staged_watched_dates = staged_watched_dates
    db.flush()
    return watch


def get_pending_watch_batch(
    db: Session,
    film_ids: list[uuid.UUID],
) -> dict[uuid.UUID, FilmWatch]:
    if not film_ids:
        return {}
    stmt = select(FilmWatch).where(
        FilmWatch.film_id.in_(film_ids),
        FilmWatch.is_pending.is_(True),
    )
    return {watch.film_id: watch for watch in db.scalars(stmt).all()}


def get_latest_watched_at_batch(
    db: Session,
    film_ids: list[uuid.UUID],
) -> dict[uuid.UUID, date]:
    if not film_ids:
        return {}
    stmt = (
        select(FilmWatch.film_id, func.max(FilmWatch.watched_at))
        .where(FilmWatch.film_id.in_(film_ids))
        .group_by(FilmWatch.film_id)
    )
    return {film_id: watched_at for film_id, watched_at in db.execute(stmt).all()}
