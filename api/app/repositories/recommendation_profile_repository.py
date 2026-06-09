"""Recommendation profile data-access helpers."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import RecommendationProfile


def get_by_hash(db: Session, profile_hash: str) -> RecommendationProfile | None:
    stmt = select(RecommendationProfile).where(RecommendationProfile.profile_hash == profile_hash)
    return db.scalars(stmt).first()


def create(
    db: Session,
    *,
    profile_hash: str,
    structured_profile: dict[str, Any],
    narrative_profile: str | None,
    embedding_model: str | None,
    embedding_version: str | None,
    embedding: list[float] | None,
) -> RecommendationProfile:
    profile = RecommendationProfile(
        profile_hash=profile_hash,
        structured_profile=structured_profile,
        narrative_profile=narrative_profile,
        embedding_model=embedding_model,
        embedding_version=embedding_version,
        embedding=embedding,
    )
    db.add(profile)
    db.flush()
    return profile


def get_by_id(db: Session, profile_id: uuid.UUID) -> RecommendationProfile | None:
    return db.get(RecommendationProfile, profile_id)
