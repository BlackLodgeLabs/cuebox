"""Metadata match review endpoints per api-contracts.md §5."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_metadata_service, get_provider_service
from app.repositories import metadata_review_repository
from app.schemas.review_schemas import ResolveLetterboxdRequest, ReviewActionResponse
from app.services.enrichment_pipeline import (
    run_semantic_pipeline_for_film,
    sync_import_job_progress,
)
from app.services.metadata_service import MetadataService
from app.services.provider_service import ProviderService

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/{review_id}/accept", response_model=ReviewActionResponse)
async def accept_review(
    review_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    metadata_service: MetadataService = Depends(get_metadata_service),
    provider_service: ProviderService = Depends(get_provider_service),
) -> ReviewActionResponse:
    film = await metadata_service.accept_review(db, review_id)
    db.commit()
    background_tasks.add_task(run_semantic_pipeline_for_film, film.id, provider_service)
    review = metadata_review_repository.get_by_id(db, review_id)
    return ReviewActionResponse(
        review_id=review_id,
        film_id=film.id,
        review_status="accepted",
        reviewed_at=review.reviewed_at if review and review.reviewed_at else datetime.now(UTC),
    )


@router.post("/{review_id}/reject", response_model=ReviewActionResponse)
def reject_review(
    review_id: uuid.UUID,
    db: Session = Depends(get_db),
    metadata_service: MetadataService = Depends(get_metadata_service),
) -> ReviewActionResponse:
    film = metadata_service.reject_review(db, review_id)
    db.commit()
    # Ensure import job counters reflect this terminal failure immediately.
    if getattr(film, "import_job_id", None):
        try:
            sync_import_job_progress(db, film.import_job_id)
            db.commit()
        except Exception:
            # Do not fail the request if progress sync encounters an error.
            db.rollback()
    review = metadata_review_repository.get_by_id(db, review_id)
    return ReviewActionResponse(
        review_id=review_id,
        film_id=film.id,
        review_status="rejected",
        reviewed_at=review.reviewed_at if review and review.reviewed_at else datetime.now(UTC),
    )


@router.post("/{review_id}/resolve-letterboxd", response_model=ReviewActionResponse)
async def resolve_letterboxd_review(
    review_id: uuid.UUID,
    body: ResolveLetterboxdRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    metadata_service: MetadataService = Depends(get_metadata_service),
    provider_service: ProviderService = Depends(get_provider_service),
) -> ReviewActionResponse:
    film = await metadata_service.resolve_letterboxd_review(
        db, review_id, body.letterboxd_uri
    )
    db.commit()
    background_tasks.add_task(run_semantic_pipeline_for_film, film.id, provider_service)
    review = metadata_review_repository.get_by_id(db, review_id)
    return ReviewActionResponse(
        review_id=review_id,
        film_id=film.id,
        review_status="accepted",
        reviewed_at=review.reviewed_at if review and review.reviewed_at else datetime.now(UTC),
    )
