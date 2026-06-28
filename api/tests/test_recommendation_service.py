"""Unit tests for recommendation service quick-pick behavior."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

from app.services.quick_pick_presets import merge_quick_pick_notes
from app.services.recommendation_service import RecommendationService


def _diversified_item(score: float) -> MagicMock:
    item = MagicMock()
    item.film_id = uuid.uuid4()
    item.final_score = score
    return item


def test_stage5_stochastic_tighter_band_excludes_nearby_candidates():
    service = RecommendationService(MagicMock())
    diversified = [
        _diversified_item(0.80),
        _diversified_item(0.74),
        _diversified_item(0.70),
    ]

    def band_count(band: float) -> int:
        top_score = diversified[0].final_score
        return len(
            [
                item
                for item in diversified
                if item.final_score >= top_score - band
            ]
        )

    assert band_count(0.04) == 1
    assert band_count(0.08) == 2

    tight_result = service._stage5_stochastic(diversified, band=0.04)
    assert tight_result[0].final_score == 0.80
    assert len(tight_result) == 3


def test_merge_quick_pick_notes_appends_label():
    assert merge_quick_pick_notes(None, "cozy_night_in") == "Quick pick: Cozy night in"


def test_merge_quick_pick_notes_preserves_existing_user_notes():
    merged = merge_quick_pick_notes("Rainy evening", "cozy_night_in")
    assert merged == "Rainy evening\nQuick pick: Cozy night in"


def test_merge_quick_pick_notes_skips_duplicate():
    existing = "Quick pick: Cozy night in"
    assert merge_quick_pick_notes(existing, "cozy_night_in") == existing


def test_merge_quick_pick_notes_case_insensitive_duplicate():
    existing = "quick pick: cozy night in"
    assert merge_quick_pick_notes(existing, "cozy_night_in") == existing
