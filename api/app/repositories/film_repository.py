"""Film data-access helpers."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database.enums import EnrichmentStatus, FilmStatus
from app.database.models import Film, WatchlistEntry

FilmSortField = Literal["title", "year", "created_at", "enrichment_status"]
SortDirection = Literal["asc", "desc"]

_SORT_COLUMNS: dict[FilmSortField, object] = {
    "title": Film.title,
    "year": Film.year,
    "created_at": Film.created_at,
    "enrichment_status": Film.enrichment_status,
}


def get_by_id(db: Session, film_id: uuid.UUID) -> Film | None:
    return db.get(Film, film_id)


def get_by_id_with_relations(db: Session, film_id: uuid.UUID) -> Film | None:
    stmt = (
        select(Film)
        .where(Film.id == film_id)
        .options(
            selectinload(Film.metadata_),
            selectinload(Film.semantic_profile),
        )
    )
    return db.scalars(stmt).first()


def get_by_letterboxd_uri(db: Session, letterboxd_uri: str) -> Film | None:
    stmt = select(Film).where(Film.letterboxd_uri == letterboxd_uri)
    return db.scalars(stmt).first()


def create(
    db: Session,
    *,
    title: str,
    letterboxd_uri: str,
    year: int | None,
    import_job_id: uuid.UUID,
) -> Film:
    film = Film(
        title=title,
        year=year,
        letterboxd_uri=letterboxd_uri,
        import_job_id=import_job_id,
    )
    db.add(film)
    db.flush()
    return film


def reset_failed_for_retry(
    db: Session,
    film: Film,
    *,
    import_job_id: uuid.UUID,
    title: str,
    year: int | None,
) -> Film:
    film.enrichment_status = EnrichmentStatus.PENDING
    film.import_job_id = import_job_id
    film.title = title
    film.year = year
    db.flush()
    return film


def update_enrichment_status(
    db: Session,
    film: Film,
    status: EnrichmentStatus,
) -> Film:
    film.enrichment_status = status
    db.flush()
    return film


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


def list_films(
    db: Session,
    *,
    status: FilmStatus | None = None,
    enrichment_status: EnrichmentStatus | None = None,
    on_watchlist: bool = False,
    search: str | None = None,
    year: int | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    sort: FilmSortField = "created_at",
    sort_dir: SortDirection = "desc",
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Film], int]:
    stmt = select(Film).options(selectinload(Film.metadata_))
    count_stmt = select(func.count()).select_from(Film)

    if on_watchlist:
        watchlist_join = (
            WatchlistEntry,
            (WatchlistEntry.film_id == Film.id) & WatchlistEntry.active.is_(True),
        )
        stmt = stmt.join(*watchlist_join)
        count_stmt = count_stmt.join(*watchlist_join)

    if status is not None:
        stmt = stmt.where(Film.status == status)
        count_stmt = count_stmt.where(Film.status == status)
    if enrichment_status is not None:
        stmt = stmt.where(Film.enrichment_status == enrichment_status)
        count_stmt = count_stmt.where(Film.enrichment_status == enrichment_status)
    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(func.lower(Film.title).like(pattern))
        count_stmt = count_stmt.where(func.lower(Film.title).like(pattern))
    if year is not None:
        stmt = stmt.where(Film.year == year)
        count_stmt = count_stmt.where(Film.year == year)
    if year_from is not None:
        stmt = stmt.where(Film.year >= year_from)
        count_stmt = count_stmt.where(Film.year >= year_from)
    if year_to is not None:
        stmt = stmt.where(Film.year <= year_to)
        count_stmt = count_stmt.where(Film.year <= year_to)
    if created_from is not None:
        start = datetime.combine(created_from, datetime.min.time())
        stmt = stmt.where(Film.created_at >= start)
        count_stmt = count_stmt.where(Film.created_at >= start)
    if created_to is not None:
        end = datetime.combine(created_to, datetime.max.time())
        stmt = stmt.where(Film.created_at <= end)
        count_stmt = count_stmt.where(Film.created_at <= end)

    sort_column = _SORT_COLUMNS[sort]
    order = sort_column.asc() if sort_dir == "asc" else sort_column.desc()

    total = db.scalar(count_stmt) or 0
    films = list(db.scalars(stmt.order_by(order).limit(limit).offset(offset)).all())
    return films, total


def list_films_for_job(db: Session, job_id: uuid.UUID) -> list[Film]:
    stmt = select(Film).where(Film.import_job_id == job_id).order_by(Film.created_at)
    return list(db.scalars(stmt).all())


_TERMINAL_PROCESSED_STATUSES = {
    EnrichmentStatus.READY,
    EnrichmentStatus.FAILED,
}


def count_by_import_job_status(db: Session, job_id: uuid.UUID) -> dict[str, int]:
    films = list_films_for_job(db, job_id)
    failed = sum(1 for f in films if f.enrichment_status == EnrichmentStatus.FAILED)
    processed = sum(1 for f in films if f.enrichment_status in _TERMINAL_PROCESSED_STATUSES)
    return {
        "total": len(films),
        "processed": processed,
        "failed": failed,
    }


def list_failed_for_job(db: Session, job_id: uuid.UUID) -> list[Film]:
    stmt = select(Film).where(
        Film.import_job_id == job_id,
        Film.enrichment_status == EnrichmentStatus.FAILED,
    )
    return list(db.scalars(stmt).all())


def archive_film(db: Session, film: Film) -> Film:
    film.status = FilmStatus.ARCHIVED
    db.flush()
    return film


def mark_watched(db: Session, film: Film) -> Film:
    film.status = FilmStatus.WATCHED
    db.flush()
    return film


def restore_active(db: Session, film: Film) -> Film:
    film.status = FilmStatus.ACTIVE
    db.flush()
    return film


def list_recommendation_candidates(
    db: Session,
    *,
    runtime_max: int | None = None,
    exclude_non_english: bool = False,
) -> list[Film]:
    """Active, ready films eligible for recommendation Stage 1 filtering."""
    from app.database.models import FilmMetadata

    stmt = (
        select(Film)
        .join(FilmMetadata, FilmMetadata.film_id == Film.id)
        .where(
            Film.status == FilmStatus.ACTIVE,
            Film.enrichment_status == EnrichmentStatus.READY,
        )
        .options(
            selectinload(Film.metadata_),
            selectinload(Film.semantic_profile),
            selectinload(Film.exposure),
        )
    )
    if runtime_max is not None:
        stmt = stmt.where(
            (FilmMetadata.runtime.is_(None)) | (FilmMetadata.runtime <= runtime_max)
        )
    if exclude_non_english:
        stmt = stmt.where(
            (FilmMetadata.original_language.is_(None))
            | (FilmMetadata.original_language == "en")
        )
    return list(db.scalars(stmt).all())


def get_many_by_ids_with_relations(db: Session, film_ids: list[uuid.UUID]) -> list[Film]:
    if not film_ids:
        return []
    stmt = (
        select(Film)
        .where(Film.id.in_(film_ids))
        .options(
            selectinload(Film.metadata_),
            selectinload(Film.semantic_profile),
        )
    )
    return list(db.scalars(stmt).all())
