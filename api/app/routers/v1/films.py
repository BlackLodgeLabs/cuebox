"""Film endpoints per api-contracts.md §4."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import not_found, validation_error
from app.database.enums import EnrichmentStatus, FilmStatus
from app.dependencies import get_db
from app.repositories import film_repository, metadata_review_repository
from app.repositories.film_repository import FilmSortField, SortDirection
from app.schemas.film_schemas import (
    FilmDetail,
    FilmListResponse,
    PaginationMeta,
    ReviewRequiredListResponse,
)
from app.services.film_presenter import film_to_detail, film_to_summary, review_to_item

router = APIRouter(prefix="/films", tags=["films"])

_VALID_SORT_FIELDS = {"title", "year", "created_at", "enrichment_status"}
_VALID_SORT_DIRS = {"asc", "desc"}


def _parse_film_status(value: str | None) -> FilmStatus | None:
    if value is None:
        return None
    try:
        return FilmStatus(value)
    except ValueError as exc:
        raise validation_error(f"Invalid status: {value}") from exc


def _parse_enrichment_status(value: str | None) -> EnrichmentStatus | None:
    if value is None:
        return None
    try:
        return EnrichmentStatus(value)
    except ValueError as exc:
        raise validation_error(f"Invalid enrichment_status: {value}") from exc


def _parse_sort(value: str | None) -> FilmSortField:
    if value is None:
        return "created_at"
    if value not in _VALID_SORT_FIELDS:
        raise validation_error(
            f"Invalid sort: {value}. Must be one of: {', '.join(sorted(_VALID_SORT_FIELDS))}"
        )
    return value  # type: ignore[return-value]


def _parse_sort_dir(value: str | None) -> SortDirection:
    if value is None:
        return "desc"
    if value not in _VALID_SORT_DIRS:
        raise validation_error(f"Invalid sort_dir: {value}. Must be asc or desc")
    return value  # type: ignore[return-value]


@router.get("", response_model=FilmListResponse)
def list_films(
    status: str | None = None,
    enrichment_status: str | None = None,
    on_watchlist: bool = False,
    search: str | None = None,
    year: int | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    sort: str | None = None,
    sort_dir: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> FilmListResponse:
    films, total = film_repository.list_films(
        db,
        status=_parse_film_status(status),
        enrichment_status=_parse_enrichment_status(enrichment_status),
        on_watchlist=on_watchlist,
        search=search,
        year=year,
        year_from=year_from,
        year_to=year_to,
        created_from=created_from,
        created_to=created_to,
        sort=_parse_sort(sort),
        sort_dir=_parse_sort_dir(sort_dir),
        limit=limit,
        offset=offset,
    )
    return FilmListResponse(
        data=[film_to_summary(f) for f in films],
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=offset + len(films) < total,
        ),
    )


@router.get("/review-required", response_model=ReviewRequiredListResponse)
def list_review_required(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ReviewRequiredListResponse:
    rows, total = metadata_review_repository.list_pending(db, limit=limit, offset=offset)
    data = [review_to_item(film, review) for film, review in rows]
    return ReviewRequiredListResponse(
        data=data,
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=offset + len(data) < total,
        ),
    )


@router.get("/{film_id}", response_model=FilmDetail)
def get_film(
    film_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> FilmDetail:
    film = film_repository.get_by_id_with_relations(db, film_id)
    if film is None:
        raise not_found("Film")
    return film_to_detail(film)
