"""Metadata match review endpoints per api-contracts.md §5."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_metadata_service
from app.repositories import metadata_review_repository
from app.schemas.review_schemas import ReviewActionResponse
from app.services.metadata_service import MetadataService

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/{review_id}/accept", response_model=ReviewActionResponse)
async def accept_review(
    review_id: uuid.UUID,
    db: Session = Depends(get_db),
    metadata_service: MetadataService = Depends(get_metadata_service),
) -> ReviewActionResponse:
    film = await metadata_service.accept_review(db, review_id)
    db.commit()
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
    review = metadata_review_repository.get_by_id(db, review_id)
    return ReviewActionResponse(
        review_id=review_id,
        film_id=film.id,
        review_status="rejected",
        reviewed_at=review.reviewed_at if review and review.reviewed_at else datetime.now(UTC),
    )
