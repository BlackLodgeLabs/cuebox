"""Watchlist CSV import and background enrichment orchestration."""

from __future__ import annotations

import logging
import uuid

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.database.enums import EnrichmentStatus, ImportJobStatus
from app.database.models import ImportJob
from app.database.session import SessionLocal
from app.repositories import film_repository, import_job_repository, watchlist_repository
from app.services.csv_parser import parse_watchlist_csv
from app.services.metadata_service import MetadataService
from app.services.provider_service import ProviderService

logger = logging.getLogger(__name__)

class ImportService:
    def __init__(self, provider_service: ProviderService) -> None:
        self._providers = provider_service

    def create_import(
        self,
        db: Session,
        content: bytes,
        background_tasks: BackgroundTasks,
    ) -> ImportJob:
        parsed = parse_watchlist_csv(content)
        job = import_job_repository.create(db)
        duplicate_films = 0
        queued_films = 0

        for row in parsed.rows:
            existing = film_repository.get_by_letterboxd_uri(db, row.letterboxd_uri)
            if existing is not None:
                if existing.enrichment_status == EnrichmentStatus.FAILED:
                    # Capture the original job to adjust its counters after moving
                    old_job_id = existing.import_job_id
                    film_repository.reset_failed_for_retry(
                        db,
                        existing,
                        import_job_id=job.id,
                        title=row.title,
                        year=row.year,
                    )
                    # If the film belonged to a different (older) job, decrement that job's total
                    if old_job_id and old_job_id != job.id:
                        old_job = import_job_repository.get_by_id(db, old_job_id)
                        if old_job is not None and old_job.total_films is not None:
                            # Recalculate counters for the previous job after moving the film
                            counts = film_repository.count_by_import_job_status(db, old_job_id)
                            import_job_repository.update_counters(
                                db,
                                old_job,
                                total_films=counts["total"],
                                processed_films=counts["processed"],
                                failed_films=counts["failed"],
                            )
                    watchlist_repository.ensure_active_entry(
                        db,
                        film_id=existing.id,
                        letterboxd_uri=row.letterboxd_uri,
                    )
                    queued_films += 1
                else:
                    duplicate_films += 1
                continue

            film = film_repository.create(
                db,
                title=row.title,
                letterboxd_uri=row.letterboxd_uri,
                year=row.year,
                import_job_id=job.id,
            )
            watchlist_repository.create_active_entry(
                db,
                film_id=film.id,
                letterboxd_uri=row.letterboxd_uri,
            )
            queued_films += 1

        import_job_repository.update_counters(
            db,
            job,
            total_films=queued_films,
            duplicate_films=duplicate_films,
        )
        db.commit()
        db.refresh(job)

        background_tasks.add_task(run_import_enrichment, job.id, self._providers)
        return job

    def get_job_status(self, db: Session, job_id: uuid.UUID) -> ImportJob:
        job = import_job_repository.get_by_id(db, job_id)
        if job is None:
            from app.core.exceptions import not_found

            raise not_found("Import job")

        counts = film_repository.count_by_import_job_status(db, job_id)
        failed_films = film_repository.list_failed_for_job(db, job_id)
        failure_summary = None
        if failed_films:
            failure_summary = [
                {"letterboxd_uri": f.letterboxd_uri, "reason": _failure_reason(job, f)}
                for f in failed_films
            ]

        import_job_repository.update_counters(
            db,
            job,
            processed_films=counts["processed"],
            failed_films=counts["failed"],
            failure_summary=failure_summary,
        )

        if (
            job.total_films is not None
            and counts["processed"] >= job.total_films
            and job.total_films > 0
            and job.status == ImportJobStatus.RUNNING
        ):
            import_job_repository.mark_complete(db, job)
        elif job.total_films == 0 and job.status == ImportJobStatus.RUNNING:
            import_job_repository.mark_complete(db, job)

        db.commit()
        db.refresh(job)
        return job


def _failure_reason(job: ImportJob, film) -> str:
    if job.failure_summary:
        for item in job.failure_summary:
            if item.get("letterboxd_uri") == film.letterboxd_uri:
                return item.get("reason", "Enrichment failed")
    return "Enrichment failed"


async def run_import_enrichment(job_id: uuid.UUID, provider_service: ProviderService) -> None:
    db = SessionLocal()
    try:
        metadata = MetadataService(provider_service)
        films = film_repository.list_films_for_job(db, job_id)
        job = import_job_repository.get_by_id(db, job_id)
        if job is None:
            return

        for film in films:
            if film.enrichment_status != EnrichmentStatus.PENDING:
                continue
            await metadata.enrich_film(db, film.id)
            db.commit()
            _sync_job_progress(db, job_id)

        job = import_job_repository.get_by_id(db, job_id)
        if job is not None:
            counts = film_repository.count_by_import_job_status(db, job_id)
            if job.total_films is not None and counts["processed"] >= job.total_films:
                import_job_repository.mark_complete(db, job)
            db.commit()
    except Exception:
        logger.exception("Import enrichment failed for job %s", job_id)
        db.rollback()
    finally:
        db.close()


def _sync_job_progress(db: Session, job_id: uuid.UUID) -> None:
    job = import_job_repository.get_by_id(db, job_id)
    if job is None:
        return
    counts = film_repository.count_by_import_job_status(db, job_id)
    failed_films = film_repository.list_failed_for_job(db, job_id)
    # Preserve any existing, specific failure reasons already recorded on the job.
    if failed_films:
        existing_reasons = {}
        if job.failure_summary:
            for item in job.failure_summary:
                uri = item.get("letterboxd_uri")
                if uri:
                    existing_reasons[uri] = item.get("reason", "Enrichment failed")
        failure_summary = [
            {
                "letterboxd_uri": f.letterboxd_uri,
                "reason": existing_reasons.get(f.letterboxd_uri, "Enrichment failed"),
            }
            for f in failed_films
        ]
    else:
        failure_summary = None
    import_job_repository.update_counters(
        db,
        job,
        processed_films=counts["processed"],
        failed_films=counts["failed"],
        failure_summary=failure_summary,
    )
