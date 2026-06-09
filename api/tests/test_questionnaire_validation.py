"""Unit tests for questionnaire validation."""

import pytest
from pydantic import ValidationError

from app.core.exceptions import AppError
from app.schemas.recommendations import CreateRecommendationRequest, QuestionnaireRequest


def _questionnaire(**overrides):
    base = {
        "genres": ["Horror"],
        "runtime": "le_120",
        "viewing_context": "solo",
        "thinking_effort": "decent_plot",
        "pacing": "slow_burn",
        "emotional_outcomes": ["Disturbed"],
        "visual_tonal_vibes": ["Atmospheric"],
        "era": "modern_classics",
        "subtitle_preference": "no_preference",
        "obscurity_preference": "hidden_gems",
    }
    base.update(overrides)
    return base


def test_no_preference_conflict_genres():
    with pytest.raises(AppError) as exc:
        QuestionnaireRequest(**_questionnaire(genres=["No Preference", "Horror"]))
    assert exc.value.code.value == "NO_PREFERENCE_CONFLICT"


def test_valid_questionnaire_request():
    request = CreateRecommendationRequest(
        questionnaire=QuestionnaireRequest(**_questionnaire()),
        notes="Slow burn please",
    )
    assert request.notes == "Slow burn please"


def test_notes_max_length():
    with pytest.raises(ValidationError):
        CreateRecommendationRequest(
            questionnaire=QuestionnaireRequest(**_questionnaire()),
            notes="x" * 1001,
        )
