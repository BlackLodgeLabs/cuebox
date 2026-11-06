"""Unit tests for ranking prompt schema and OpenAI ranking JSON parse."""

from __future__ import annotations

import uuid

from app.prompts.ranking import PROMPT_VERSION, SYSTEM_PROMPT
from app.providers.ranking.base import RankingCandidateInput
from app.providers.ranking.openai import _parse_ranking_json
from app.services.recommendation_service import (
    _explanation_from_payload,
    _explanation_to_payload,
)


def _candidate(film_id: uuid.UUID, title: str = "Film") -> RankingCandidateInput:
    return RankingCandidateInput(
        film_id=film_id,
        title=title,
        year=1999,
        runtime=120,
        director="Director",
        genres=["Drama"],
        semantic_summary=None,
        raw_score=0.8,
        final_score=0.9,
        score_breakdown={},
    )


def test_ranking_prompt_includes_short_field_and_bumped_version():
    assert PROMPT_VERSION == "recommendation-v2"
    assert "why_it_matches_short" in SYSTEM_PROMPT
    assert "one or two phone-friendly" in SYSTEM_PROMPT.lower()


def test_parse_ranking_json_reads_short_and_blank_becomes_none():
    winner = uuid.uuid4()
    runner = uuid.uuid4()
    raw = f"""{{
      "winner_film_id": "{winner}",
      "runners_up_film_ids": ["{runner}"],
      "explanations": {{
        "{winner}": {{
          "why_it_matches": "Full multi-sentence rationale for the pick.",
          "why_it_matches_short": "Phone-friendly why.",
          "most_influential_factors": ["theme fit"],
          "why_it_beat_alternatives": "Best overall.",
          "caveats": null
        }},
        "{runner}": {{
          "why_it_matches": "Runner full why.",
          "why_it_matches_short": "   ",
          "most_influential_factors": ["semantic fit"],
          "why_it_beat_alternatives": null,
          "caveats": null
        }}
      }}
    }}"""
    result = _parse_ranking_json(
        raw,
        [_candidate(winner, "Winner"), _candidate(runner, "Runner")],
        tokens_input=10,
        tokens_output=20,
    )
    assert result.explanations[str(winner)].why_it_matches_short == "Phone-friendly why."
    assert result.explanations[str(runner)].why_it_matches_short is None


def test_parse_ranking_json_missing_short_is_none():
    winner = uuid.uuid4()
    raw = f"""{{
      "winner_film_id": "{winner}",
      "runners_up_film_ids": [],
      "explanations": {{
        "{winner}": {{
          "why_it_matches": "Full rationale only.",
          "most_influential_factors": ["theme fit"],
          "why_it_beat_alternatives": "Best overall.",
          "caveats": null
        }}
      }}
    }}"""
    result = _parse_ranking_json(
        raw,
        [_candidate(winner)],
        tokens_input=1,
        tokens_output=1,
    )
    assert result.explanations[str(winner)].why_it_matches_short is None


def test_parse_ranking_json_synthesizer_sets_brief_short():
    winner = uuid.uuid4()
    runner = uuid.uuid4()
    raw = f"""{{
      "winner_film_id": "{winner}",
      "runners_up_film_ids": ["{runner}"],
      "explanations": {{}}
    }}"""
    result = _parse_ranking_json(
        raw,
        [_candidate(winner), _candidate(runner)],
        tokens_input=1,
        tokens_output=1,
    )
    winner_expl = result.explanations[str(winner)]
    assert winner_expl.why_it_matches_short == "Strong preference match."
    assert winner_expl.why_it_matches_short != winner_expl.why_it_matches
    assert result.explanations[str(runner)].why_it_matches_short == "Strong preference match."


def test_explanation_payload_round_trip_preserves_short():
    payload = {
        "why_it_matches": "Full multi-sentence rationale.",
        "why_it_matches_short": "Brief why.",
        "most_influential_factors": ["theme fit"],
        "why_it_beat_alternatives": "Best overall.",
        "caveats": None,
    }
    explanation = _explanation_from_payload(payload)
    assert explanation.why_it_matches_short == "Brief why."
    round_trip = _explanation_to_payload(explanation)
    assert round_trip["why_it_matches_short"] == "Brief why."


def test_explanation_from_payload_blank_or_missing_short_is_none():
    assert (
        _explanation_from_payload(
            {
                "why_it_matches": "Full",
                "most_influential_factors": [],
                "why_it_matches_short": "",
            }
        ).why_it_matches_short
        is None
    )
    assert (
        _explanation_from_payload(
            {"why_it_matches": "Full", "most_influential_factors": []}
        ).why_it_matches_short
        is None
    )


def test_default_synthesizer_payload_sets_brief_short_not_long_copy():
    payload = _explanation_to_payload(object())
    assert payload["why_it_matches_short"] == "Strong preference match."
    assert payload["why_it_matches_short"] != payload["why_it_matches"]
    fallback = _explanation_from_payload(object())
    assert fallback.why_it_matches_short == "Strong preference match."
    assert fallback.why_it_matches_short != fallback.why_it_matches
