"""Recommendation result data-access helpers."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.database.models import RecommendationResult


def create(
    db: Session,
    *,
    session_id: uuid.UUID,
    winner_explanation: str | None,
    winner_explanation_detail: dict[str, Any] | None,
    runner_up_explanations: dict[str, Any] | None,
) -> RecommendationResult:
    result = RecommendationResult(
        session_id=session_id,
        winner_explanation=winner_explanation,
        winner_explanation_detail=winner_explanation_detail,
        runner_up_explanations=runner_up_explanations,
    )
    db.add(result)
    db.flush()
    return result
