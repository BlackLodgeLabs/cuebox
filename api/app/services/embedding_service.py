"""Film embedding generation and persistence."""

from __future__ import annotations

import uuid

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_app_config
from app.core.exceptions import AppError
from app.database.enums import EmbeddingType
from app.providers.embedding.base import EMBEDDING_DIMENSION
from app.repositories import (
    film_embedding_repository,
    film_metadata_repository,
    film_repository,
    semantic_profile_repository,
)
from app.schemas.errors import ErrorCode
from app.services.provider_service import ProviderService

EMBEDDING_VERSION = "embedding-v1"


class EmbeddingService:
    def __init__(self, provider_service: ProviderService) -> None:
        self._providers = provider_service

    async def embed(self, db: Session, film_id: uuid.UUID) -> None:
        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise AppError(
                code=ErrorCode.NOT_FOUND,
                message="Film not found",
                status_code=404,
            )

        metadata = film_metadata_repository.get_by_film_id(db, film_id)
        profile = semantic_profile_repository.get_by_film_id(db, film_id)
        if metadata is None or profile is None:
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message="Metadata and semantic profile are required before embedding",
                status_code=500,
            )

        text = compose_embedding_input(
            synopsis=metadata.synopsis,
            genres=list(metadata.genres) if metadata.genres else [],
            keywords=list(metadata.keywords) if metadata.keywords else [],
            semantic_summary=profile.semantic_summary,
            themes=list(profile.themes) if profile.themes else [],
        )

        config = get_app_config()
        provider = self._providers.get_embedding_provider()
        model = config.providers.embedding.model

        try:
            vector = await provider.embed(text)
        except httpx.HTTPError as exc:
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message=f"Embedding generation failed: {exc}",
                status_code=502,
            ) from exc
        except ValueError as exc:
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message=str(exc),
                status_code=502,
            ) from exc

        if len(vector) != EMBEDDING_DIMENSION:
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message=f"Embedding dimension {len(vector)} != {EMBEDDING_DIMENSION}",
                status_code=502,
            )

        film_embedding_repository.upsert(
            db,
            film_id,
            embedding_type=EmbeddingType.SEMANTIC,
            embedding_version=EMBEDDING_VERSION,
            embedding_model=model,
            vector=vector,
        )


def compose_embedding_input(
    *,
    synopsis: str | None,
    genres: list[str],
    keywords: list[str],
    semantic_summary: str | None,
    themes: list[str] | None = None,
) -> str:
    """Build the text blob sent to the embedding provider."""
    parts: list[str] = []
    if synopsis:
        parts.append(f"Synopsis: {synopsis}")
    if genres:
        parts.append(f"Genres: {', '.join(genres)}")
    if keywords:
        parts.append(f"Keywords: {', '.join(keywords)}")
    if themes:
        parts.append(f"Themes: {', '.join(themes)}")
    if semantic_summary:
        parts.append(f"Summary: {semantic_summary}")
    if not parts:
        return "Film"
    return "\n".join(parts)
