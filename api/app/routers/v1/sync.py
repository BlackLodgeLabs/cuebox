"""Synchronisation endpoints per api-contracts.md §6."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile
from sqlalchemy.orm import Session

from app.core.exceptions import validation_error
from app.dependencies import get_db, get_sync_service, get_watched_import_service
from app.repositories import sync_config_repository
from app.schemas.sync import (
    FilmSyncSummary,
    RssConfigRequest,
    RssConfigResponse,
    RssStatusResponse,
    SyncCsvResponse,
    SyncWatchedFailure,
    SyncWatchedResponse,
)
from app.services.sync_service import SyncService
from app.services.watched_import_service import WatchedImportService

router = APIRouter(prefix="/sync", tags=["sync"])


def _require_csv(file: UploadFile | None, field_name: str) -> UploadFile:
    if file is None:
        raise validation_error(f"{field_name} file field is required")
    filename = file.filename or ""
    content_type = file.content_type or ""
    if not (
        filename.lower().endswith(".csv")
        or content_type in ("text/csv", "application/csv", "application/vnd.ms-excel")
    ):
        raise validation_error(f"{field_name} must be a CSV file")
    return file


@router.post("/csv", response_model=SyncCsvResponse)
async def sync_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile | None = None,
    db: Session = Depends(get_db),
    sync_service: SyncService = Depends(get_sync_service),
) -> SyncCsvResponse:
    if file is None:
        raise validation_error("File field is required")

    filename = file.filename or ""
    content_type = file.content_type or ""
    if not (
        filename.lower().endswith(".csv")
        or content_type in ("text/csv", "application/csv", "application/vnd.ms-excel")
    ):
        raise validation_error("Uploaded file must be a CSV")

    content = await file.read()
    result = sync_service.sync_csv(db, content, background_tasks)
    return SyncCsvResponse(
        added=result.added,
        unchanged=result.unchanged,
        failed=result.failed,
        added_films=[FilmSyncSummary(**item) for item in result.added_films],
    )


@router.post("/watched", response_model=SyncWatchedResponse)
async def sync_watched(
    background_tasks: BackgroundTasks,
    watched: UploadFile | None = None,
    ratings: UploadFile | None = None,
    diary: UploadFile | None = None,
    db: Session = Depends(get_db),
    watched_import_service: WatchedImportService = Depends(get_watched_import_service),
) -> SyncWatchedResponse:
    watched_file = _require_csv(watched, "watched")
    ratings_file = _require_csv(ratings, "ratings")
    diary_file = _require_csv(diary, "diary")

    result = watched_import_service.import_watched(
        db,
        await watched_file.read(),
        await ratings_file.read(),
        await diary_file.read(),
        background_tasks,
    )
    return SyncWatchedResponse(
        films_seen=result.films_seen,
        films_created=result.films_created,
        watches_created=result.watches_created,
        watches_skipped_duplicate=result.watches_skipped_duplicate,
        pending_review=result.pending_review,
        enrichment_job_id=result.enrichment_job_id,
        failures=[
            SyncWatchedFailure(
                title=item.title,
                year=item.year,
                letterboxd_uri=item.letterboxd_uri,
                reason=item.reason,
            )
            for item in result.failures
        ],
    )


@router.put("/rss", response_model=RssConfigResponse)
def configure_rss(
    body: RssConfigRequest,
    db: Session = Depends(get_db),
    sync_service: SyncService = Depends(get_sync_service),
) -> RssConfigResponse:
    config = sync_service.configure_rss(db, body.username)
    return RssConfigResponse(
        username=config.rss_username or body.username,
        polling_interval_seconds=sync_config_repository.POLLING_INTERVAL_SECONDS,
        configured_at=config.configured_at,
    )


@router.get("/rss/status", response_model=RssStatusResponse)
def get_rss_status(
    db: Session = Depends(get_db),
    sync_service: SyncService = Depends(get_sync_service),
) -> RssStatusResponse:
    return RssStatusResponse(**sync_service.get_rss_status(db))
