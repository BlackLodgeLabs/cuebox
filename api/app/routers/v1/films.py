"""Film endpoints per api-contracts.md §4."""

import uuid
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import not_found, validation_error
from app.database.enums import EnrichmentStatus, FilmStatus
from app.dependencies import get_db, get_metadata_service, get_provider_service, get_watch_provider_service
from app.repositories import film_repository, film_watch_repository, metadata_review_repository, watchlist_repository
from app.repositories.film_repository import FilmSortField, SortDirection
from app.schemas.film_schemas import (
    FilmDetail,
    FilmListResponse,
    FilmStatusRequest,
    FilmWatchSummary,
    PaginationMeta,
    RematchRequest,
    RematchResponse,
    ReviewRequiredListResponse,
    TmdbSearchResponse,
)
from app.schemas.watch_providers import FilmWatchProvidersResponse
from app.services.enrichment_pipeline import run_semantic_pipeline_for_film
from app.schemas.watch_review_schemas import (
    CompleteWatchReviewRequest,
    PendingReviewCountResponse,
    UpdateWatchRequest,
    WatchReviewRequiredListResponse,
)
from app.services.film_presenter import (
    film_to_detail,
    film_to_summary,
    review_to_item,
    watch_review_to_item,
    watch_to_summary,
)
from app.services.film_status_service import FilmStatusService
from app.services.watch_review_service import WatchReviewService
from app.services.metadata_service import MetadataService
from app.services.provider_service import ProviderService
from app.services.watch_provider_service import WatchProviderService

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


def _parse_film_statuses(value: str | None) -> list[FilmStatus] | None:
    if value is None:
        return None
    tokens = [token.strip() for token in value.split(",")]
    if not tokens or any(token == "" for token in tokens):
        raise validation_error("statuses must be a non-empty comma-separated list of film statuses")
    parsed: list[FilmStatus] = []
    seen: set[FilmStatus] = set()
    for token in tokens:
        status = _parse_film_status(token)
        assert status is not None
        if status not in seen:
            seen.add(status)
            parsed.append(status)
    return parsed


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
    statuses: str | None = None,
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
    if status is not None and statuses is not None:
        raise validation_error("Cannot combine status and statuses query parameters")
    parsed_status = _parse_film_status(status)
    parsed_statuses = _parse_film_statuses(statuses)
    films, total = film_repository.list_films(
        db,
        status=parsed_status,
        statuses=parsed_statuses,
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
    removed_at_map: dict = {}
    latest_watched_at_map: dict = {}
    pending_watch_map: dict = {}
    needs_watch_extras = parsed_status in (FilmStatus.WATCHED, FilmStatus.ARCHIVED) or (
        parsed_statuses is not None
        and bool(
            set(parsed_statuses)
            & {
                FilmStatus.WATCHED,
                FilmStatus.ARCHIVED,
                FilmStatus.PENDING_WATCH_REVIEW,
            }
        )
    )
    if needs_watch_extras:
        film_ids = [film.id for film in films]
        removed_at_map = watchlist_repository.get_latest_removed_at_batch(db, film_ids)
        latest_watched_at_map = film_watch_repository.get_latest_watched_at_batch(db, film_ids)
        pending_watch_map = film_watch_repository.get_pending_watch_batch(db, film_ids)
    return FilmListResponse(
        data=[
            film_to_summary(
                film,
                removed_at=removed_at_map.get(film.id),
                latest_watched_at=latest_watched_at_map.get(film.id),
                pending_watch=pending_watch_map.get(film.id),
            )
            for film in films
        ],
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=offset + len(films) < total,
        ),
    )


@router.get("/reviews/pending-count", response_model=PendingReviewCountResponse)
def get_pending_review_count(db: Session = Depends(get_db)) -> PendingReviewCountResponse:
    _, metadata_total = metadata_review_repository.list_pending(db, limit=1, offset=0)
    watch_total = film_watch_repository.count_pending_watch_reviews(db)
    return PendingReviewCountResponse(
        metadata_count=metadata_total,
        watch_review_count=watch_total,
        total=metadata_total + watch_total,
    )


@router.get("/watch-review-required", response_model=WatchReviewRequiredListResponse)
def list_watch_review_required(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> WatchReviewRequiredListResponse:
    rows, total = film_watch_repository.list_pending_watch_reviews(
        db, limit=limit, offset=offset
    )
    data = [watch_review_to_item(film, watch) for film, watch in rows]
    return WatchReviewRequiredListResponse(
        data=data,
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=offset + len(data) < total,
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


@router.get("/tmdb-search", response_model=TmdbSearchResponse)
async def tmdb_search_global(
    q: str = Query(min_length=1),
    year: int | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=20),
    metadata_service: MetadataService = Depends(get_metadata_service),
) -> TmdbSearchResponse:
    results, pagination = await metadata_service.search_tmdb_global(
        q=q, year=year, page=page, limit=limit
    )
    return TmdbSearchResponse(data=results, pagination=pagination)


@router.get("/{film_id}/tmdb-search", response_model=TmdbSearchResponse)
async def tmdb_search(
    film_id: uuid.UUID,
    q: str = Query(min_length=1),
    year: int | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=20),
    db: Session = Depends(get_db),
    metadata_service: MetadataService = Depends(get_metadata_service),
) -> TmdbSearchResponse:
    results, pagination = await metadata_service.search_tmdb(
        db, film_id, q=q, year=year, page=page, limit=limit
    )
    return TmdbSearchResponse(data=results, pagination=pagination)


@router.post("/{film_id}/rematch", response_model=RematchResponse, status_code=202)
async def rematch_film(
    film_id: uuid.UUID,
    body: RematchRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    metadata_service: MetadataService = Depends(get_metadata_service),
    provider_service: ProviderService = Depends(get_provider_service),
) -> RematchResponse:
    film = await metadata_service.rematch_film(db, film_id, body.tmdb_id)
    db.commit()
    background_tasks.add_task(run_semantic_pipeline_for_film, film.id, provider_service)
    return RematchResponse(film_id=film.id, enrichment_status="enriching")


@router.get("/{film_id}/watch-providers", response_model=FilmWatchProvidersResponse)
async def get_film_watch_providers(
    film_id: uuid.UUID,
    country: str | None = None,
    db: Session = Depends(get_db),
    watch_provider_service: WatchProviderService = Depends(get_watch_provider_service),
) -> FilmWatchProvidersResponse:
    return await watch_provider_service.get_watch_providers(db, film_id, country_code=country)


@router.post("/{film_id}/watch-review", response_model=FilmDetail)
def complete_watch_review(
    film_id: uuid.UUID,
    body: CompleteWatchReviewRequest,
    db: Session = Depends(get_db),
) -> FilmDetail:
    film = WatchReviewService.complete_review(
        db,
        film_id,
        score=body.score,
        watched_at=body.watched_at,
        notes=body.notes,
    )
    db.commit()
    film = film_repository.get_by_id_with_relations(db, film.id)
    assert film is not None
    watches = film_watch_repository.list_all_for_film(db, film.id)
    return film_to_detail(film, watches=watches)


@router.delete("/{film_id}/watch-review", status_code=204)
def cancel_watch_review(
    film_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> None:
    WatchReviewService.cancel_review(db, film_id)
    db.commit()


@router.patch("/{film_id}/watches/{watch_id}", response_model=FilmWatchSummary)
def update_film_watch(
    film_id: uuid.UUID,
    watch_id: uuid.UUID,
    body: UpdateWatchRequest,
    db: Session = Depends(get_db),
) -> FilmWatchSummary:
    watch = WatchReviewService.edit_watch(
        db,
        film_id,
        watch_id,
        score=body.score,
        watched_at=body.watched_at,
        notes=body.notes,
    )
    db.commit()
    return watch_to_summary(watch)


@router.post("/{film_id}/status", response_model=FilmDetail)
def set_film_status(
    film_id: uuid.UUID,
    body: FilmStatusRequest,
    db: Session = Depends(get_db),
) -> FilmDetail:
    try:
        target_status = FilmStatus(body.status)
    except ValueError as exc:
        from app.core.exceptions import unprocessable

        raise unprocessable(f"Invalid status: {body.status}") from exc

    film = FilmStatusService.transition(db, film_id, target_status)
    db.commit()
    film = film_repository.get_by_id_with_relations(db, film.id)
    assert film is not None
    watches = film_watch_repository.list_all_for_film(db, film.id)
    return film_to_detail(film, watches=watches)


@router.get("/{film_id}", response_model=FilmDetail)
def get_film(
    film_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> FilmDetail:
    film = film_repository.get_by_id_with_relations(db, film_id)
    if film is None:
        raise not_found("Film")
    watches = film_watch_repository.list_all_for_film(db, film_id)
    return film_to_detail(film, watches=watches)
