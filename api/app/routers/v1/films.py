"""Film endpoints per api-contracts.md §4."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import not_found, validation_error
from app.database.enums import EnrichmentStatus, FilmStatus
from app.dependencies import get_db
from app.repositories import film_repository, metadata_review_repository
from app.schemas.film_schemas import (
    FilmDetail,
    FilmListResponse,
    PaginationMeta,
    ReviewRequiredListResponse,
)
from app.services.film_presenter import film_to_detail, film_to_summary, review_to_item

router = APIRouter(prefix="/films", tags=["films"])


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


@router.get("", response_model=FilmListResponse)
def list_films(
    status: str | None = None,
    enrichment_status: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> FilmListResponse:
    films, total = film_repository.list_films(
        db,
        status=_parse_film_status(status),
        enrichment_status=_parse_enrichment_status(enrichment_status),
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
