"""Confidence scoring unit tests."""

from app.services.confidence import compute_confidence, confidence_action


def _score(**kwargs) -> float:
    defaults = {
        "csv_title": "The Matrix",
        "csv_year": 1999,
        "csv_director": None,
        "tmdb_title": "The Matrix",
        "tmdb_original_title": "The Matrix",
        "tmdb_year": 1999,
        "tmdb_director": "Lana Wachowski",
    }
    defaults.update(kwargs)
    return compute_confidence(**defaults)


def test_high_confidence_auto_accept():
    score = _score(csv_director="Lana Wachowski")
    assert score >= 0.95
    assert confidence_action(score) == "auto_accept"


def test_boundary_095_auto_accept():
    score = 0.95
    assert confidence_action(score) == "auto_accept"


def test_boundary_0949_accept_flag():
    score = 0.945
    assert confidence_action(score) == "accept_flag"


def test_boundary_080_accept_flag():
    score = 0.80
    assert confidence_action(score) == "accept_flag"


def test_boundary_0799_manual_review():
    score = 0.7999
    assert confidence_action(score) == "manual_review"


def test_low_title_similarity_manual_review():
    score = _score(csv_title="Completely Different", tmdb_title="Unrelated Film")
    assert confidence_action(score) == "manual_review"
