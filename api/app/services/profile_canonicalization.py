"""Recommendation profile canonicalization and hashing."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonicalize(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, dict):
        return {
            key: canonicalize(inner)
            for key, inner in sorted(value.items())
            if inner is not None and inner != [] and inner != ""
        }
    if isinstance(value, list):
        if all(isinstance(item, str) for item in value):
            return sorted(item.strip().lower() for item in value if item and item.strip())
        return sorted(canonicalize(item) for item in value if item is not None)
    if isinstance(value, str):
        return value.strip().lower()
    return value


def profile_hash(canonical_profile: dict[str, Any]) -> str:
    payload = json.dumps(canonical_profile, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def build_structured_profile(questionnaire: dict[str, Any]) -> dict[str, Any]:
    return {
        "genres": questionnaire.get("genres", []),
        "runtime": questionnaire.get("runtime"),
        "viewing_context": questionnaire.get("viewing_context"),
        "thinking_effort": questionnaire.get("thinking_effort"),
        "pacing": questionnaire.get("pacing"),
        "desired_emotions": questionnaire.get("emotional_outcomes", []),
        "visual_tonal_vibes": questionnaire.get("visual_tonal_vibes", []),
        "era": questionnaire.get("era"),
        "subtitle_preference": questionnaire.get("subtitle_preference"),
        "obscurity_preference": questionnaire.get("obscurity_preference"),
    }


def _is_no_preference(values: list[str]) -> bool:
    if not values:
        return True
    normalized = {str(item).strip().lower() for item in values}
    return normalized == {"no preference"}


def build_narrative_profile(structured: dict[str, Any], notes: str | None) -> str:
    parts: list[str] = []
    genres = structured.get("genres") or []
    if genres and not _is_no_preference(genres):
        parts.append(", ".join(genres))
    pacing = structured.get("pacing")
    if pacing and pacing != "no_preference":
        parts.append(f"{pacing.replace('_', ' ')} pacing")
    emotions = structured.get("desired_emotions") or []
    if emotions and not _is_no_preference(emotions):
        parts.append(f"seeking {', '.join(emotions).lower()} outcomes")
    vibes = structured.get("visual_tonal_vibes") or []
    if vibes and not _is_no_preference(vibes):
        parts.append(f"{', '.join(vibes).lower()} vibes")
    if notes and notes.strip():
        parts.append(notes.strip())
    if not parts:
        return "Open to any film that fits the current watchlist mood."
    return " ".join(parts).capitalize() + "."
