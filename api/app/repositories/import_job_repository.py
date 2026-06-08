"""Import job data-access helpers."""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.database.enums import ImportJobStatus
from app.database.models import ImportJob


def get_by_id(db: Session, job_id: uuid.UUID) -> ImportJob | None:
    return db.get(ImportJob, job_id)


def create(
    db: Session,
    *,
    total_films: int | None = None,
    status: ImportJobStatus = ImportJobStatus.RUNNING,
) -> ImportJob:
    job = ImportJob(status=status, total_films=total_films)
    db.add(job)
    db.flush()
    return job


def mark_complete(db: Session, job: ImportJob) -> ImportJob:
    from datetime import UTC, datetime

    job.status = ImportJobStatus.COMPLETE
    job.completed_at = datetime.now(UTC)
    db.flush()
    return job


_UNSET = object()


def update_counters(
    db: Session,
    job: ImportJob,
    *,
    processed_films: int | None = None,
    failed_films: int | None = None,
    duplicate_films: int | None = None,
    total_films: int | None = None,
    failure_summary: dict[str, Any] | list[Any] | None | object = _UNSET,
    status: ImportJobStatus | None = None,
) -> ImportJob:
    if total_films is not None:
        job.total_films = total_films
    if processed_films is not None:
        job.processed_films = processed_films
    if failed_films is not None:
        job.failed_films = failed_films
    if duplicate_films is not None:
        job.duplicate_films = duplicate_films
    if failure_summary is not _UNSET:
        job.failure_summary = failure_summary
    if status is not None:
        job.status = status
    db.flush()
    return job
