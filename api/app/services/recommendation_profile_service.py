"""Recommendation profile creation and caching."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_app_config
from app.repositories import recommendation_profile_repository, system_version_repository
from app.services.profile_canonicalization import (
    build_narrative_profile,
    build_structured_profile,
    canonicalize,
    profile_hash,
)
from app.services.provider_service import ProviderService


@dataclass
class ProfileResult:
    profile_id: Any
    structured_profile: dict[str, Any]
    narrative_profile: str
    embedding: list[float]
    profile_cache_hit: bool
    embedding_model: str
    embedding_version: str


class RecommendationProfileService:
    def __init__(self, provider_service: ProviderService) -> None:
        self._providers = provider_service

    async def resolve_profile(
        self,
        db: Session,
        questionnaire: dict[str, Any],
        notes: str | None,
    ) -> ProfileResult:
        structured = build_structured_profile(questionnaire)
        narrative = build_narrative_profile(structured, notes)
        canonical = canonicalize({**structured, "notes": notes})
        digest = profile_hash(canonical)

        existing = recommendation_profile_repository.get_by_hash(db, digest)
        if existing is not None and existing.embedding is not None:
            return ProfileResult(
                profile_id=existing.id,
                structured_profile=existing.structured_profile,
                narrative_profile=existing.narrative_profile or narrative,
                embedding=list(existing.embedding),
                profile_cache_hit=True,
                embedding_model=existing.embedding_model or "",
                embedding_version=existing.embedding_version or "",
            )

        config = get_app_config()
        embedding_provider = self._providers.get_embedding_provider()
        embedding_version_row = system_version_repository.get_active_version(
            db, "film-embedding"
        )
        embedding_version = (
            embedding_version_row.version if embedding_version_row else "embedding-v1"
        )
        embed_input = f"{narrative}\n{structured}"
        vector = await embedding_provider.embed(embed_input)

        profile = recommendation_profile_repository.create(
            db,
            profile_hash=digest,
            structured_profile=structured,
            narrative_profile=narrative,
            embedding_model=config.providers.embedding.model,
            embedding_version=embedding_version,
            embedding=vector,
        )
        return ProfileResult(
            profile_id=profile.id,
            structured_profile=structured,
            narrative_profile=narrative,
            embedding=vector,
            profile_cache_hit=False,
            embedding_model=config.providers.embedding.model,
            embedding_version=embedding_version,
        )
