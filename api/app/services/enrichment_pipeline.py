"""Shared enrichment pipeline helpers for metadata, semantic, and embedding stages."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from app.core.config import get_app_config
from app.core.exceptions import AppError
from app.database.enums import EnrichmentStatus, ImportJobStatus
from app.database.models import Film
from app.database.session import SessionLocal
from app.repositories import film_repository, import_job_repository
from app.services.embedding_service import EmbeddingService
from app.services.provider_service import ProviderService
from app.services.semantic_service import SemanticService

logger = logging.getLogger(__name__)


def mark_film_failed(db: Session, film: Film, reason: str) -> None:
    """Mark a film failed and append its reason to the import job failure summary."""
    film_repository.update_enrichment_status(db, film, EnrichmentStatus.FAILED)
    if not film.import_job_id:
        return
    job = import_job_repository.get_by_id(db, film.import_job_id)
    if job is None:
        return
    summary = list(job.failure_summary or [])
    summary.append({"letterboxd_uri": film.letterboxd_uri, "reason": reason})
    import_job_repository.update_counters(db, job, failure_summary=summary)


def sync_import_job_progress(db: Session, job_id: uuid.UUID) -> None:
    """Recompute import job counters and failure summary from film rows."""
    job = import_job_repository.get_by_id(db, job_id)
    if job is None:
        return
    counts = film_repository.count_by_import_job_status(db, job_id)
    failed_films = film_repository.list_failed_for_job(db, job_id)
    if failed_films:
        existing_reasons: dict[str, str] = {}
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
    if (
        job.total_films is not None
        and counts["processed"] >= job.total_films
        and job.total_films > 0
        and job.status == ImportJobStatus.RUNNING
    ):
        import_job_repository.mark_complete(db, job)


async def run_semantic_pipeline(
    db: Session,
    film_id: uuid.UUID,
    provider_service: ProviderService,
) -> None:
    """Run semantic enrichment and embedding for a film already in enriching status."""
    film = film_repository.get_by_id(db, film_id)
    if film is None or film.enrichment_status != EnrichmentStatus.ENRICHING:
        return

    semantic = SemanticService(provider_service)
    embedding = EmbeddingService(provider_service)
    try:
        await semantic.enrich(db, film_id)
        await embedding.embed(db, film_id)
        film = film_repository.get_by_id(db, film_id)
        if film is not None:
            film_repository.update_enrichment_status(db, film, EnrichmentStatus.READY)
    except AppError as exc:
        film = film_repository.get_by_id(db, film_id)
        if film is not None:
            mark_film_failed(db, film, exc.message)
    except Exception as exc:
        logger.exception("Semantic pipeline failed for film %s", film_id)
        film = film_repository.get_by_id(db, film_id)
        if film is not None:
            mark_film_failed(db, film, f"Unexpected error: {exc}")


async def run_semantic_pipeline_for_film(
    film_id: uuid.UUID,
    provider_service: ProviderService,
) -> None:
    """Background-task entry point with its own database session."""
    db = SessionLocal()
    try:
        # First, run the semantic pipeline and persist its outcome (READY/FAILED).
        await run_semantic_pipeline(db, film_id, provider_service)
        try:
            db.commit()
        except Exception:
            logger.exception("Commit failed after semantic pipeline for film %s", film_id)
            try:
                db.rollback()
            except Exception:
                logger.exception(
                    "Rollback after commit failure also failed for film %s", film_id
                )
            # If we cannot persist the pipeline outcome, abort progress sync.
            return

        # Then, best-effort progress sync that must not undo the persisted outcome.
        try:
            film = film_repository.get_by_id(db, film_id)
            if film is not None and film.import_job_id:
                sync_import_job_progress(db, film.import_job_id)
            db.commit()
        except Exception:
            logger.exception("Progress sync failed for film %s", film_id)
            try:
                db.rollback()
            except Exception:
                logger.exception(
                    "Rollback after progress sync failure also failed for film %s", film_id
                )
    except Exception:
        logger.exception("Background semantic pipeline failed for film %s", film_id)
        try:
            db.rollback()
        except Exception:
            logger.exception("Rollback failed after semantic pipeline error for film %s", film_id)
    finally:
        db.close()


def inter_film_delay_seconds() -> float:
    """Configurable delay between per-film enrichment steps for rate limiting."""
    try:
        config = get_app_config()
        return float(config.enrichment.inter_film_delay_seconds)
    except Exception:
        return 0.0
