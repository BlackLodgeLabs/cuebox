"""Resolve configured metadata, semantic, and embedding provider clients."""

from __future__ import annotations

import httpx

from app.core.config import AppConfig, Settings
from app.core.exceptions import AppError
from app.providers.embedding.base import EmbeddingProvider
from app.providers.embedding.openai import OpenAIEmbeddingProvider
from app.providers.embedding.voyage import VoyageEmbeddingProvider
from app.providers.omdb import OmdbClient
from app.providers.semantic.base import SemanticEnrichmentProvider
from app.providers.semantic.ollama import OllamaSemanticProvider
from app.providers.semantic.openai import OpenAISemanticProvider
from app.providers.tmdb import TmdbClient
from app.schemas.errors import ErrorCode

_HTTP_TIMEOUT = httpx.Timeout(connect=5.0, read=30.0, write=30.0, pool=5.0)


class ProviderService:
    def __init__(self, settings: Settings, config: AppConfig) -> None:
        self._settings = settings
        self._config = config
        self._http_client: httpx.AsyncClient | None = None
        self._tmdb: TmdbClient | None = None
        self._omdb: OmdbClient | None = None
        self._semantic: SemanticEnrichmentProvider | None = None
        self._embedding: EmbeddingProvider | None = None

    async def startup(self, http_client: httpx.AsyncClient | None = None) -> None:
        if self._http_client is not None:
            return
        self._http_client = http_client or httpx.AsyncClient(timeout=_HTTP_TIMEOUT)
        if self._config.providers.metadata.tmdb.enabled and self._settings.tmdb_api_key:
            self._tmdb = TmdbClient(self._http_client, self._settings.tmdb_api_key)
        if (
            self._config.providers.metadata.omdb.enabled
            and self._settings.omdb_api_key
        ):
            self._omdb = OmdbClient(self._http_client, self._settings.omdb_api_key)

        semantic_name = self._config.providers.semantic_enrichment.provider.lower()
        if semantic_name == "openai" and self._settings.openai_api_key:
            self._semantic = OpenAISemanticProvider(
                self._http_client,
                self._settings.openai_api_key,
                model=self._config.providers.semantic_enrichment.model,
            )
        elif semantic_name == "ollama":
            self._semantic = OllamaSemanticProvider(
                self._http_client,
                self._settings.ollama_base_url,
                model=self._config.providers.semantic_enrichment.model,
            )

        embedding_name = self._config.providers.embedding.provider.lower()
        if embedding_name == "openai" and self._settings.openai_api_key:
            self._embedding = OpenAIEmbeddingProvider(
                self._http_client,
                self._settings.openai_api_key,
                model=self._config.providers.embedding.model,
            )
        elif embedding_name == "voyage" and self._settings.voyage_api_key:
            self._embedding = VoyageEmbeddingProvider(
                self._http_client,
                self._settings.voyage_api_key,
                model=self._config.providers.embedding.model,
            )

    async def shutdown(self) -> None:
        if self._http_client is not None:
            await self._http_client.aclose()
        self._http_client = None
        self._tmdb = None
        self._omdb = None
        self._semantic = None
        self._embedding = None

    @property
    def http_client(self) -> httpx.AsyncClient | None:
        return self._http_client

    def get_tmdb_client(self) -> TmdbClient:
        if self._tmdb is None:
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message="TMDB provider is not configured or TMDB_API_KEY is missing",
                status_code=500,
            )
        return self._tmdb

    def get_omdb_client(self) -> OmdbClient | None:
        return self._omdb

    def get_semantic_provider(self) -> SemanticEnrichmentProvider:
        if self._semantic is None:
            provider = self._config.providers.semantic_enrichment.provider
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message=f"Semantic provider '{provider}' is not configured",
                status_code=500,
            )
        return self._semantic

    def get_embedding_provider(self) -> EmbeddingProvider:
        if self._embedding is None:
            provider = self._config.providers.embedding.provider
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message=f"Embedding provider '{provider}' is not configured",
                status_code=500,
            )
        return self._embedding
