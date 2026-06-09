"""Unit tests for profile canonicalization and hashing."""

from app.services.profile_canonicalization import (
    build_narrative_profile,
    build_structured_profile,
    canonicalize,
    profile_hash,
)


def test_canonicalize_sorts_arrays_and_normalizes_case():
    data = {
        "genres": ["Horror", " Folk Horror "],
        "pacing": "slow_burn",
        "desired_emotions": ["Disturbed", "Unsettled"],
    }
    canonical = canonicalize(data)
    assert canonical["genres"] == ["folk horror", "horror"]
    assert canonical["desired_emotions"] == ["disturbed", "unsettled"]


def test_profile_hash_is_stable():
    questionnaire = {
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
    structured = build_structured_profile(questionnaire)
    canonical = canonicalize(structured)
    first = profile_hash(canonical)
    second = profile_hash(canonicalize(build_structured_profile(questionnaire)))
    assert first == second
    assert len(first) == 64


def test_narrative_profile_no_preference_only():
    structured = build_structured_profile(
        {
            "genres": ["No Preference"],
            "runtime": "any",
            "viewing_context": "solo",
            "thinking_effort": "brain_off",
            "pacing": "no_preference",
            "emotional_outcomes": ["No Preference"],
            "visual_tonal_vibes": ["No Preference"],
            "era": "no_preference",
            "subtitle_preference": "no_preference",
            "obscurity_preference": "no_preference",
        }
    )
    narrative = build_narrative_profile(structured, None)
    assert "open" in narrative.lower()
