"""Synchronisation endpoints per api-contracts.md §6."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile
from sqlalchemy.orm import Session

from app.core.exceptions import validation_error
from app.dependencies import get_db, get_sync_service
from app.repositories import sync_config_repository
from app.schemas.sync import (
    FilmSyncSummary,
    RssConfigRequest,
    RssConfigResponse,
    RssStatusResponse,
    SyncCsvResponse,
)
from app.services.sync_service import SyncService

router = APIRouter(prefix="/sync", tags=["sync"])


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
        removed=result.removed,
        watched=result.watched,
        unchanged=result.unchanged,
        failed=result.failed,
        added_films=[FilmSyncSummary(**item) for item in result.added_films],
        removed_films=[FilmSyncSummary(**item) for item in result.removed_films],
        watched_films=[FilmSyncSummary(**item) for item in result.watched_films],
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
