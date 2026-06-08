"""Semantic profile generation and persistence."""

from __future__ import annotations

import logging
import uuid

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_app_config
from app.core.exceptions import AppError
from app.prompts.semantic_enrichment import SEMANTIC_VERSION
from app.providers.semantic.base import SemanticEnrichmentContext
from app.providers.semantic.openai import SemanticParseError
from app.repositories import film_metadata_repository, film_repository, semantic_profile_repository
from app.schemas.errors import ErrorCode
from app.services.provider_service import ProviderService

logger = logging.getLogger(__name__)


class SemanticService:
    def __init__(self, provider_service: ProviderService) -> None:
        self._providers = provider_service

    async def enrich(self, db: Session, film_id: uuid.UUID) -> None:
        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise AppError(
                code=ErrorCode.NOT_FOUND,
                message="Film not found",
                status_code=404,
            )

        metadata = film_metadata_repository.get_by_film_id(db, film_id)
        if metadata is None:
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message="Film metadata is required before semantic enrichment",
                status_code=500,
            )

        context = SemanticEnrichmentContext(
            title=film.title,
            year=film.year,
            synopsis=metadata.synopsis,
            genres=list(metadata.genres) if metadata.genres else [],
            keywords=list(metadata.keywords) if metadata.keywords else [],
            director=metadata.director,
        )

        config = get_app_config()
        provider = self._providers.get_semantic_provider()
        model = config.providers.semantic_enrichment.model

        try:
            result = await provider.enrich(context)
        except SemanticParseError as exc:
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message=str(exc),
                status_code=502,
            ) from exc
        except httpx.HTTPError as exc:
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message=f"Semantic enrichment failed: {exc}",
                status_code=502,
            ) from exc

        semantic_profile_repository.upsert(
            db,
            film_id,
            result,
            semantic_version=SEMANTIC_VERSION,
            generated_by_model=model,
        )
