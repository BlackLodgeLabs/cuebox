"""Unit tests for scoring signal calculations."""

from decimal import Decimal
from unittest.mock import MagicMock

from app.core.config import ScoringConfig
from app.services.scoring_service import score_candidates


def _weights() -> ScoringConfig:
    return ScoringConfig(
        theme_fit=0.22,
        emotional_fit=0.20,
        visual_tonal_fit=0.13,
        pacing_fit=0.15,
        complexity_fit=0.10,
        era_fit=0.07,
        obscurity_fit=0.03,
        viewing_context_fit=0.05,
        diversity_adjustment=0.05,
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
        "visual_tonal_vibes": ["gritty"],
    }
    scored = score_candidates([_film()], structured, _weights())
    assert len(scored) == 1
    assert scored[0].raw_score > 0
    assert "theme_fit" in scored[0].score_breakdown
    assert scored[0].score_breakdown["theme_fit"] > 0.5


def test_visual_tonal_fit_high_when_tones_match():
    film = _film()
    film.semantic_profile.tones = ["Gritty", "Atmospheric"]
    film.semantic_profile.visual_descriptors = ["Muted"]
    structured = {
        "genres": ["horror"],
        "pacing": "slow_burn",
        "thinking_effort": "decent_plot",
        "era": "no_preference",
        "obscurity_preference": "no_preference",
        "viewing_context": "solo",
        "desired_emotions": ["disturbed"],
        "visual_tonal_vibes": ["Gritty", "Muted"],
    }
    scored = score_candidates([film], structured, _weights())
    assert scored[0].score_breakdown["visual_tonal_fit"] > 0.5


def test_visual_tonal_fit_low_when_no_overlap():
    film = _film()
    film.semantic_profile.tones = ["Bright"]
    film.semantic_profile.visual_descriptors = ["Sun-drenched"]
    structured = {
        "genres": ["horror"],
        "pacing": "slow_burn",
        "thinking_effort": "decent_plot",
        "era": "no_preference",
        "obscurity_preference": "no_preference",
        "viewing_context": "solo",
        "desired_emotions": ["disturbed"],
        "visual_tonal_vibes": ["Noir", "Muted"],
    }
    scored = score_candidates([film], structured, _weights())
    assert scored[0].score_breakdown["visual_tonal_fit"] == 0.25


def test_visual_tonal_fit_neutral_when_no_preference():
    film = _film()
    film.semantic_profile.tones = ["Gritty"]
    film.semantic_profile.visual_descriptors = []
    structured = {
        "genres": ["horror"],
        "pacing": "slow_burn",
        "thinking_effort": "decent_plot",
        "era": "no_preference",
        "obscurity_preference": "no_preference",
        "viewing_context": "solo",
        "desired_emotions": ["disturbed"],
        "visual_tonal_vibes": ["No Preference"],
    }
    scored = score_candidates([film], structured, _weights())
    assert scored[0].score_breakdown["visual_tonal_fit"] == 0.75


def test_visual_tonal_fit_degraded_when_semantic_missing():
    film = _film()
    film.semantic_profile = None
    structured = {
        "genres": ["horror"],
        "pacing": "slow_burn",
        "thinking_effort": "decent_plot",
        "era": "no_preference",
        "obscurity_preference": "no_preference",
        "viewing_context": "solo",
        "desired_emotions": ["disturbed"],
        "visual_tonal_vibes": ["Gritty"],
    }
    scored = score_candidates([film], structured, _weights())
    assert scored[0].score_breakdown["visual_tonal_fit"] == 0.35
