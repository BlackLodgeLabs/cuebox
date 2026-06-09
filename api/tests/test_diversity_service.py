"""Unit tests for diversity adjustment math."""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

from app.core.config import ScoringConfig
from app.database.models import RecommendationExposure
from app.services.diversity_service import apply_diversity
from app.services.scoring_service import ScoredCandidate


def _weights() -> ScoringConfig:
    return ScoringConfig(
        theme_fit=0.25,
        emotional_fit=0.20,
        pacing_fit=0.15,
        complexity_fit=0.10,
        era_fit=0.10,
        obscurity_fit=0.05,
        viewing_context_fit=0.05,
        diversity_adjustment=0.10,
    )


def test_exposure_penalty_reduces_effective_score():
    film_id = uuid.uuid4()
    film = MagicMock()
    film.id = film_id
    scored = [ScoredCandidate(film=film, raw_score=0.8, score_breakdown={"theme_fit": 0.8})]
    exposure = RecommendationExposure(
        film_id=film_id,
        recommendation_count=5,
        winner_count=2,
        last_recommended_at=datetime.now(UTC) - timedelta(days=3),
    )
    adjusted = apply_diversity(scored, {film_id: exposure}, _weights())
    assert adjusted[0].final_score < scored[0].raw_score


def test_fresh_film_gets_bonus():
    film_id = uuid.uuid4()
    film = MagicMock()
    film.id = film_id
    scored = [ScoredCandidate(film=film, raw_score=0.5, score_breakdown={"theme_fit": 0.5})]
    adjusted = apply_diversity(scored, {}, _weights())
    assert adjusted[0].final_score > scored[0].raw_score
