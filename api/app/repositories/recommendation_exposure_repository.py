"""Recommendation exposure counter data-access helpers."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import RecommendationExposure


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
