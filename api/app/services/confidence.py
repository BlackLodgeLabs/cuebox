"""TMDB match confidence scoring."""

from __future__ import annotations

import re
from difflib import SequenceMatcher

_TITLE_WEIGHT = 0.55
_YEAR_WEIGHT = 0.30
_DIRECTOR_WEIGHT = 0.15

_ARTICLES = re.compile(r"^(the|a|an)\s+", re.IGNORECASE)
_PUNCTUATION = re.compile(r"[^\w\s]", re.UNICODE)


def normalize_title(title: str) -> str:
    normalized = title.lower().strip()
    normalized = _PUNCTUATION.sub("", normalized)
    normalized = _ARTICLES.sub("", normalized)
    return " ".join(normalized.split())


def title_similarity(csv_title: str, tmdb_title: str, tmdb_original_title: str) -> float:
    csv_norm = normalize_title(csv_title)
    candidates = [normalize_title(tmdb_title)]
    if tmdb_original_title:
        candidates.append(normalize_title(tmdb_original_title))
    return max(SequenceMatcher(None, csv_norm, c).ratio() for c in candidates)


def year_score(csv_year: int | None, tmdb_year: int | None) -> float:
    if csv_year is None:
        return 0.5
    if tmdb_year is None:
        return 0.0
    diff = abs(csv_year - tmdb_year)
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.7
    return 0.0


def director_score(csv_director: str | None, tmdb_director: str | None) -> float | None:
    if tmdb_director is None:
        return None
    if not csv_director or not csv_director.strip():
        return 0.5
    return 1.0 if normalize_title(csv_director) == normalize_title(tmdb_director) else 0.0


def compute_confidence(
    *,
    csv_title: str,
    csv_year: int | None,
    csv_director: str | None,
    tmdb_title: str,
    tmdb_original_title: str,
    tmdb_year: int | None,
    tmdb_director: str | None,
) -> float:
    title = title_similarity(csv_title, tmdb_title, tmdb_original_title)
    year = year_score(csv_year, tmdb_year)
    director = director_score(csv_director, tmdb_director)

    if director is None:
        weight_sum = _TITLE_WEIGHT + _YEAR_WEIGHT
        score = (_TITLE_WEIGHT * title + _YEAR_WEIGHT * year) / weight_sum
    else:
        score = _TITLE_WEIGHT * title + _YEAR_WEIGHT * year + _DIRECTOR_WEIGHT * director
    return round(min(max(score, 0.0), 1.0), 4)


def confidence_action(score: float) -> str:
    if score >= 0.95:
        return "auto_accept"
    if score >= 0.80:
        return "accept_flag"
    return "manual_review"
