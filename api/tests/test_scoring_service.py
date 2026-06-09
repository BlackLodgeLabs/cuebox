"""Unit tests for scoring signal calculations."""

from decimal import Decimal
from unittest.mock import MagicMock

from app.core.config import ScoringConfig
from app.services.scoring_service import score_candidates


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


def _film():
    film = MagicMock()
    film.id = "00000000-0000-0000-0000-000000000001"
    film.year = 1999
    film.metadata_ = MagicMock()
    film.metadata_.genres = ["Horror"]
    film.metadata_.keywords = ["folk horror"]
    film.semantic_profile = MagicMock()
    film.semantic_profile.subgenres = ["Folk Horror"]
    film.semantic_profile.themes = ["Isolation"]
    film.semantic_profile.emotional_outcomes = ["Disturbed"]
    film.semantic_profile.viewing_contexts = ["Solo Viewing"]
    film.semantic_profile.pacing = Decimal("4.0")
    film.semantic_profile.complexity = Decimal("6.0")
    film.semantic_profile.obscurity = Decimal("4.0")
    return film


def test_scoring_produces_breakdown_and_raw_score():
    structured = {
        "genres": ["horror", "folk horror"],
        "pacing": "slow_burn",
        "thinking_effort": "decent_plot",
        "era": "modern_classics",
        "obscurity_preference": "hidden_gems",
        "viewing_context": "solo",
        "desired_emotions": ["disturbed"],
    }
    scored = score_candidates([_film()], structured, _weights())
    assert len(scored) == 1
    assert scored[0].raw_score > 0
    assert "theme_fit" in scored[0].score_breakdown
    assert scored[0].score_breakdown["theme_fit"] > 0.5
