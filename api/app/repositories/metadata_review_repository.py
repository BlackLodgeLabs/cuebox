"""Metadata match review data-access helpers."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.enums import EnrichmentStatus, ReviewStatus, ReviewType
from app.database.models import Film, MetadataMatchReview


def get_by_id(db: Session, review_id: uuid.UUID) -> MetadataMatchReview | None:
    return db.get(MetadataMatchReview, review_id)


def create(
    db: Session,
    *,
    film_id: uuid.UUID,
    candidate_tmdb_id: int,
    confidence_score: float | Decimal,
    candidate_payload: dict[str, Any] | None = None,
    review_type: ReviewType = ReviewType.TMDB_MATCH,
) -> MetadataMatchReview:
    review = MetadataMatchReview(
        film_id=film_id,
        candidate_tmdb_id=candidate_tmdb_id,
        confidence_score=Decimal(str(confidence_score)),
        candidate_payload=candidate_payload,
        review_status=ReviewStatus.PENDING,
        review_type=review_type,
    )
    db.add(review)
    db.flush()
    return review


def list_pending(
    db: Session,
    *,
    limit: int,
    offset: int,
) -> tuple[list[tuple[Film, MetadataMatchReview]], int]:
    conditions = (
        Film.enrichment_status == EnrichmentStatus.REVIEW_REQUIRED,
        MetadataMatchReview.review_status == ReviewStatus.PENDING,
    )
    total = (
        db.scalar(
            select(func.count(MetadataMatchReview.id))
            .join(Film, Film.id == MetadataMatchReview.film_id)
            .where(*conditions)
        )
        or 0
    )
    stmt = (
        select(Film, MetadataMatchReview)
        .join(MetadataMatchReview, MetadataMatchReview.film_id == Film.id)
        .where(*conditions)
        .order_by(MetadataMatchReview.created_at)
        .limit(limit)
        .offset(offset)
    )
    rows = db.execute(stmt).all()
    return list(rows), total


def update_status(
    db: Session,
    review: MetadataMatchReview,
    status: ReviewStatus,
) -> MetadataMatchReview:
    review.review_status = status
    review.reviewed_at = datetime.now(UTC)
    db.flush()
    return review


def resolve_pending_for_film(
    db: Session,
    film_id: uuid.UUID,
    *,
    status: ReviewStatus = ReviewStatus.ACCEPTED,
) -> int:
    from sqlalchemy import update

    result = db.execute(
        update(MetadataMatchReview)
        .where(
            MetadataMatchReview.film_id == film_id,
            MetadataMatchReview.review_status == ReviewStatus.PENDING,
        )
        .values(review_status=status, reviewed_at=datetime.now(UTC))
    )
    db.flush()
    return result.rowcount  # type: ignore[attr-defined]
