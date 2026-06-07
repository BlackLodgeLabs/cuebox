"""Import endpoints per api-contracts.md §3."""

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile
from sqlalchemy.orm import Session

from app.core.exceptions import validation_error
from app.dependencies import get_db, get_import_service
from app.schemas.import_schemas import (
    FailureSummaryItem,
    ImportJobResponse,
    ImportJobStatusResponse,
)
from app.services.import_service import ImportService

router = APIRouter(prefix="/import", tags=["import"])


@router.post("", status_code=202, response_model=ImportJobResponse)
async def upload_watchlist(
    background_tasks: BackgroundTasks,
    file: UploadFile | None = None,
    db: Session = Depends(get_db),
    import_service: ImportService = Depends(get_import_service),
) -> ImportJobResponse:
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
    job = import_service.create_import(db, content, background_tasks)
    return ImportJobResponse(
        job_id=job.id,
        status=job.status.value,
        created_at=job.created_at,
    )


@router.get("/{job_id}/status", response_model=ImportJobStatusResponse)
def get_import_status(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    import_service: ImportService = Depends(get_import_service),
) -> ImportJobStatusResponse:
    job = import_service.get_job_status(db, job_id)
    failure_summary = None
    if job.failure_summary:
        failure_summary = [
            FailureSummaryItem(**item) if isinstance(item, dict) else item
            for item in job.failure_summary
        ]

    return ImportJobStatusResponse(
        job_id=job.id,
        status=job.status.value,
        total_films=job.total_films,
        processed_films=job.processed_films,
        failed_films=job.failed_films,
        duplicate_films=job.duplicate_films,
        failure_summary=failure_summary,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )
