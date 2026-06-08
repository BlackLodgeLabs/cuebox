"""Unit tests for semantic service JSON validation."""

import json

from app.providers.semantic.openai import SemanticParseError, _parse_profile_json
from tests.mock_providers import DEFAULT_SEMANTIC_PROFILE


def test_valid_llm_json_maps_to_profile_fields():
    result = _parse_profile_json(json.dumps(DEFAULT_SEMANTIC_PROFILE))
    assert result.subgenres == DEFAULT_SEMANTIC_PROFILE["subgenres"]
    assert result.complexity == DEFAULT_SEMANTIC_PROFILE["complexity"]
    assert result.semantic_summary == DEFAULT_SEMANTIC_PROFILE["semantic_summary"]


def test_null_scores_are_allowed():
    payload = dict(DEFAULT_SEMANTIC_PROFILE)
    payload["complexity"] = None
    result = _parse_profile_json(json.dumps(payload))
    assert result.complexity is None


def test_invalid_json_raises_structured_error():
    try:
        _parse_profile_json("{bad")
        raise AssertionError("expected SemanticParseError")
    except SemanticParseError as exc:
        assert "Invalid JSON" in str(exc)


def test_score_out_of_range_raises():
    payload = dict(DEFAULT_SEMANTIC_PROFILE)
    payload["energy"] = -1
    try:
        _parse_profile_json(json.dumps(payload))
        raise AssertionError("expected SemanticParseError")
    except SemanticParseError as exc:
        assert "energy" in str(exc)


def test_boolean_score_rejected():
    payload = dict(DEFAULT_SEMANTIC_PROFILE)
    payload["complexity"] = True
    try:
        _parse_profile_json(json.dumps(payload))
        raise AssertionError("expected SemanticParseError")
    except SemanticParseError as exc:
        assert "complexity" in str(exc)
