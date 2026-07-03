"""Recommendation exposure counter data-access helpers."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database.models import (
    RecommendationCandidate,
    RecommendationExposure,
    RecommendationSession,
)


def get_by_film_id(db: Session, film_id: uuid.UUID) -> RecommendationExposure | None:
    return db.get(RecommendationExposure, film_id)


def get_map(db: Session, film_ids: list[uuid.UUID]) -> dict[uuid.UUID, RecommendationExposure]:
    if not film_ids:
        return {}
    stmt = select(RecommendationExposure).where(RecommendationExposure.film_id.in_(film_ids))
    rows = db.scalars(stmt).all()
    return {row.film_id: row for row in rows}


def increment_exposure(
    db: Session,
    *,
    film_id: uuid.UUID,
    is_winner: bool,
) -> RecommendationExposure:
    row = get_by_film_id(db, film_id)
    now = datetime.now(UTC)
    if row is None:
        row = RecommendationExposure(
            film_id=film_id,
            recommendation_count=1,
            winner_count=1 if is_winner else 0,
            last_recommended_at=now,
        )
        db.add(row)
    else:
        row.recommendation_count += 1
        if is_winner:
            row.winner_count += 1
        row.last_recommended_at = now
    db.flush()
    return row


def decrement_exposure(
    db: Session,
    *,
    film_id: uuid.UUID,
    is_winner: bool,
) -> None:
    row = get_by_film_id(db, film_id)
    if row is None:
        return
    row.recommendation_count = max(0, row.recommendation_count - 1)
    if is_winner:
        row.winner_count = max(0, row.winner_count - 1)
    if row.recommendation_count == 0 and row.winner_count == 0:
        db.delete(row)
    else:
        db.flush()


def recompute_last_recommended_at(
    db: Session,
    *,
    film_id: uuid.UUID,
    exclude_session_id: uuid.UUID,
) -> None:
    row = get_by_film_id(db, film_id)
    if row is None:
        return
    stmt = (
        select(func.max(RecommendationSession.created_at))
        .outerjoin(
            RecommendationCandidate,
            RecommendationCandidate.session_id == RecommendationSession.id,
        )
        .where(
            RecommendationSession.id != exclude_session_id,
            or_(
                RecommendationCandidate.film_id == film_id,
                RecommendationSession.winner_film_id == film_id,
            ),
        )
    )
    max_created_at = db.scalar(stmt)
    row.last_recommended_at = max_created_at
    db.flush()
