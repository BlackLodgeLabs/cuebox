"""Structured scoring signals for recommendation Stage 3."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.config import ScoringConfig
from app.database.models import Film, FilmSemanticProfile


@dataclass
class ScoredCandidate:
    film: Film
    raw_score: float
    score_breakdown: dict[str, float]


_RUNTIME_CEILINGS = {
    "le_90": 90,
    "le_120": 120,
    "le_150": 150,
    "any": None,
}

_PACING_TARGETS = {
    "slow_burn": 3.0,
    "balanced": 5.5,
    "fast_paced": 8.0,
    "no_preference": 5.0,
}

_COMPLEXITY_TARGETS = {
    "brain_off": 3.0,
    "decent_plot": 5.5,
    "complex_puzzle": 8.0,
}

_OBSCURITY_TARGETS = {
    "mainstream": 2.5,
    "hidden_gems": 5.5,
    "obscure": 8.0,
    "no_preference": 5.0,
}


def runtime_ceiling(runtime_pref: str) -> int | None:
    return _RUNTIME_CEILINGS.get(runtime_pref)


def score_candidates(
    films: list[Film],
    structured_profile: dict[str, Any],
    weights: ScoringConfig,
) -> list[ScoredCandidate]:
    scored: list[ScoredCandidate] = []
    for film in films:
        breakdown = _compute_breakdown(film, structured_profile)
        raw = (
            breakdown["theme_fit"] * weights.theme_fit
            + breakdown["emotional_fit"] * weights.emotional_fit
            + breakdown["visual_tonal_fit"] * weights.visual_tonal_fit
            + breakdown["pacing_fit"] * weights.pacing_fit
            + breakdown["complexity_fit"] * weights.complexity_fit
            + breakdown["era_fit"] * weights.era_fit
            + breakdown["obscurity_fit"] * weights.obscurity_fit
            + breakdown["viewing_context_fit"] * weights.viewing_context_fit
        )
        scored.append(ScoredCandidate(film=film, raw_score=raw, score_breakdown=breakdown))
    return scored


def _compute_breakdown(film: Film, profile: dict[str, Any]) -> dict[str, float]:
    semantic = film.semantic_profile
    metadata = film.metadata_
    genres_pref = _normalize_list(profile.get("genres", []))
    emotions_pref = _normalize_list(profile.get("desired_emotions", []))
    theme_fit = _overlap_score(
        genres_pref,
        _film_labels(metadata, semantic),
    )
    emotional_fit = _overlap_score(
        emotions_pref,
        _normalize_list(getattr(semantic, "emotional_outcomes", None) or []),
    )
    vibes_pref = _normalize_list(profile.get("visual_tonal_vibes", []))
    film_tonal_labels: list[str] = []
    if semantic is not None:
        film_tonal_labels.extend(_normalize_list(getattr(semantic, "tones", None) or []))
        film_tonal_labels.extend(
            _normalize_list(getattr(semantic, "visual_descriptors", None) or [])
        )
    visual_tonal_fit = _overlap_score(vibes_pref, film_tonal_labels)
    pacing_fit = _numeric_fit(
        _PACING_TARGETS.get(profile.get("pacing", "no_preference"), 5.0),
        _to_float(getattr(semantic, "pacing", None)),
    )
    complexity_fit = _numeric_fit(
        _COMPLEXITY_TARGETS.get(profile.get("thinking_effort", "decent_plot"), 5.5),
        _to_float(getattr(semantic, "complexity", None)),
    )
    era_fit = _era_fit(profile.get("era", "no_preference"), film.year)
    obscurity_fit = _numeric_fit(
        _OBSCURITY_TARGETS.get(profile.get("obscurity_preference", "no_preference"), 5.0),
        _to_float(getattr(semantic, "obscurity", None)),
    )
    viewing_context_fit = _overlap_score(
        [profile.get("viewing_context", "solo")],
        _normalize_list(getattr(semantic, "viewing_contexts", None) or []),
    )
    history_fit = 1.0

    return {
        "theme_fit": theme_fit,
        "emotional_fit": emotional_fit,
        "visual_tonal_fit": visual_tonal_fit,
        "pacing_fit": pacing_fit,
        "complexity_fit": complexity_fit,
        "era_fit": era_fit,
        "obscurity_fit": obscurity_fit,
        "viewing_context_fit": viewing_context_fit,
        "recommendation_history": history_fit,
        "diversity_adjustment": 0.0,
    }


def _film_labels(metadata, semantic: FilmSemanticProfile | None) -> list[str]:
    labels: list[str] = []
    if metadata is not None:
        labels.extend(_normalize_list(metadata.genres or []))
        labels.extend(_normalize_list(metadata.keywords or []))
    if semantic is not None:
        labels.extend(_normalize_list(semantic.subgenres or []))
        labels.extend(_normalize_list(semantic.themes or []))
    return labels


def _normalize_list(values: list[Any]) -> list[str]:
    return [str(v).strip().lower() for v in values if v and str(v).strip().lower() != "no preference"]


def _overlap_score(preferences: list[str], labels: list[str]) -> float:
    if not preferences or preferences == ["no preference"]:
        return 0.75
    if not labels:
        return 0.35
    pref_set = set(preferences)
    label_set = set(labels)
    overlap = len(pref_set & label_set)
    if overlap == 0:
        return 0.25
    return min(1.0, 0.5 + overlap / max(len(pref_set), 1) * 0.5)


def _numeric_fit(target: float, actual: float | None) -> float:
    if actual is None:
        return 0.5
    distance = abs(target - actual)
    return max(0.0, 1.0 - distance / 10.0)


def _era_fit(era_pref: str, year: int | None) -> float:
    if era_pref == "no_preference" or year is None:
        return 0.75
    if era_pref == "current" and year >= 2020:
        return 1.0
    if era_pref == "modern_classics" and 1990 <= year <= 2019:
        return 1.0
    if era_pref == "vintage" and year < 1990:
        return 1.0
    if era_pref == "current":
        return max(0.2, 1.0 - (2020 - year) / 30)
    if era_pref == "modern_classics":
        return max(0.2, 1.0 - abs(year - 2005) / 25)
    return max(0.2, 1.0 - (year - 1989) / 40)


def _to_float(value) -> float | None:
    if value is None:
        return None
    return float(value)
