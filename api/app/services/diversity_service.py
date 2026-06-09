"""Diversity adjustment for recommendation Stage 4."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.core.config import ScoringConfig
from app.database.models import RecommendationExposure
from app.services.scoring_service import ScoredCandidate


@dataclass
class DiversityAdjustedCandidate:
    film_id: uuid.UUID
    film: object
    raw_score: float
    final_score: float
    score_breakdown: dict[str, float]


def apply_diversity(
    scored: list[ScoredCandidate],
    exposure_map: dict[uuid.UUID, RecommendationExposure],
    weights: ScoringConfig,
) -> list[DiversityAdjustedCandidate]:
    adjusted: list[DiversityAdjustedCandidate] = []
    now = datetime.now(UTC)
    for item in scored:
        exposure = exposure_map.get(item.film.id)
        penalty = _exposure_penalty(exposure)
        freshness = _freshness_bonus(exposure, now)
        diversity_signal = freshness - penalty
        breakdown = dict(item.score_breakdown)
        breakdown["diversity_adjustment"] = round(diversity_signal, 6)
        final_score = item.raw_score + diversity_signal * weights.diversity_adjustment
        adjusted.append(
            DiversityAdjustedCandidate(
                film_id=item.film.id,
                film=item.film,
                raw_score=item.raw_score,
                final_score=final_score,
                score_breakdown=breakdown,
            )
        )
    adjusted.sort(key=lambda c: c.final_score, reverse=True)
    return adjusted


def _exposure_penalty(exposure: RecommendationExposure | None) -> float:
    if exposure is None:
        return 0.0
    recs = exposure.recommendation_count
    winners = exposure.winner_count
    return min(0.5, recs * 0.05 + winners * 0.1)


def _freshness_bonus(exposure: RecommendationExposure | None, now: datetime) -> float:
    if exposure is None or exposure.last_recommended_at is None:
        return 0.3
    age = now - exposure.last_recommended_at
    if age >= timedelta(days=30):
        return 0.35
    if age >= timedelta(days=14):
        return 0.2
    if age >= timedelta(days=7):
        return 0.1
    return 0.0
