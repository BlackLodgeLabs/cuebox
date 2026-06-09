"""Film semantic profile data-access helpers."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.database.models import FilmSemanticProfile
from app.providers.semantic.base import SemanticProfileResult


def get_by_film_id(db: Session, film_id: uuid.UUID) -> FilmSemanticProfile | None:
    return db.get(FilmSemanticProfile, film_id)


def upsert(
    db: Session,
    film_id: uuid.UUID,
    profile: SemanticProfileResult,
    *,
    semantic_version: str,
    generated_by_model: str,
) -> FilmSemanticProfile:
    row = get_by_film_id(db, film_id)
    fields: dict[str, Any] = {
        "subgenres": profile.subgenres,
        "themes": profile.themes,
        "tones": profile.tones,
        "visual_descriptors": profile.visual_descriptors,
        "emotional_outcomes": profile.emotional_outcomes,
        "viewing_contexts": profile.viewing_contexts,
        "complexity": Decimal(str(profile.complexity)) if profile.complexity is not None else None,
        "pacing": Decimal(str(profile.pacing)) if profile.pacing is not None else None,
        "energy": Decimal(str(profile.energy)) if profile.energy is not None else None,
        "obscurity": Decimal(str(profile.obscurity)) if profile.obscurity is not None else None,
        "semantic_summary": profile.semantic_summary,
        "semantic_version": semantic_version,
        "generated_by_model": generated_by_model,
        "generated_at": datetime.now(UTC),
    }
    if row is None:
        row = FilmSemanticProfile(film_id=film_id, **fields)
        db.add(row)
    else:
        for key, value in fields.items():
            setattr(row, key, value)
    db.flush()
    return row
