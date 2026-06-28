"""Canonical mood quick-pick preset identifiers and labels."""

from __future__ import annotations

QUICK_PICK_PRESETS: dict[str, str] = {
    "cozy_night_in": "Cozy night in",
    "adrenaline_rush": "Adrenaline rush",
    "deep_and_arty": "Deep & arty",
    "scare_me": "Scare me",
    "feel_good_escape": "Feel-good escape",
    "dark_and_unsettling": "Dark & unsettling",
}

DEFAULT_STOCHASTIC_BAND = 0.08
QUICK_PICK_STOCHASTIC_BAND = 0.04


def merge_quick_pick_notes(notes: str | None, preset_id: str | None) -> str | None:
    """Append quick-pick label to notes when preset is set and not already present."""
    if not preset_id:
        return notes
    label = QUICK_PICK_PRESETS[preset_id]
    quick_pick_note = f"Quick pick: {label}"
    existing = (notes or "").strip()
    if quick_pick_note.lower() in existing.lower():
        return existing or None
    if existing:
        return f"{existing}\n{quick_pick_note}"
    return quick_pick_note
