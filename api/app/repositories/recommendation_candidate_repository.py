"""Recommendation candidate data-access helpers."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.database.models import RecommendationCandidate


def create_many(
    db: Session,
    *,
    session_id: uuid.UUID,
    candidates: list[dict[str, Any]],
) -> list[RecommendationCandidate]:
    rows: list[RecommendationCandidate] = []
    for item in candidates:
        row = RecommendationCandidate(
            session_id=session_id,
            film_id=item["film_id"],
            retrieval_rank=item.get("retrieval_rank"),
            similarity_score=_to_decimal(item.get("similarity_score")),
            raw_score=_to_decimal(item.get("raw_score")),
            final_score=_to_decimal(item.get("final_score")),
            llm_rank=item.get("llm_rank"),
            score_breakdown=item.get("score_breakdown"),
        )
        db.add(row)
        rows.append(row)
    db.flush()
    return rows


def _to_decimal(value: float | Decimal | None) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(round(float(value), 6)))
