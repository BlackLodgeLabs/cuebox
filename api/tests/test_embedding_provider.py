"""Unit tests for embedding provider resolution."""

import httpx
import pytest

from app.core.config import AppConfig, EnrichmentConfig, ProviderConfig, ProvidersConfig, RecommendationConfig, ScoringConfig
from app.core.config import Settings
from app.providers.embedding.base import EMBEDDING_DIMENSION
from app.providers.embedding.openai import OpenAIEmbeddingProvider
from app.providers.embedding.voyage import VoyageEmbeddingProvider
from app.services.provider_service import ProviderService
from tests.mock_providers import create_mock_http_client, mock_embedding_vector


def _app_config(*, embedding_provider: str = "openai") -> AppConfig:
    return AppConfig(
        developer_mode=False,
        providers=ProvidersConfig(
            embedding=ProviderConfig(provider=embedding_provider, model="text-embedding-3-small"),
            semantic_enrichment=ProviderConfig(provider="openai", model="gpt-4o-mini"),
            ranking=ProviderConfig(provider="openai", model="gpt-4o"),
        ),
        recommendation=RecommendationConfig(retrieval_candidate_limit=100),
        enrichment=EnrichmentConfig(inter_film_delay_seconds=0),
        scoring=ScoringConfig(
            theme_fit=0.25,
            emotional_fit=0.20,
            pacing_fit=0.15,
            complexity_fit=0.10,
            era_fit=0.10,
            obscurity_fit=0.05,
            viewing_context_fit=0.05,
            diversity_adjustment=0.10,
        ),
    )


@pytest.mark.asyncio
async def test_openai_embedding_returns_1536_dimensions():
    client = create_mock_http_client()
    provider = OpenAIEmbeddingProvider(client, "test-key", model="text-embedding-3-small")
    vector = await provider.embed("test text")
    assert len(vector) == EMBEDDING_DIMENSION
    await client.aclose()


@pytest.mark.asyncio
async def test_voyage_embedding_returns_1536_dimensions():
    client = create_mock_http_client()
    provider = VoyageEmbeddingProvider(client, "test-key", model="voyage-3")
    vector = await provider.embed("test text")
    assert len(vector) == EMBEDDING_DIMENSION
    await client.aclose()


@pytest.mark.asyncio
async def test_voyage_factory_requires_voyage_api_key():
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox",
        OPENAI_API_KEY=None,
        VOYAGE_API_KEY=None,
    )
    service = ProviderService(settings, _app_config(embedding_provider="voyage"))
    await service.startup(http_client=httpx.AsyncClient())
    with pytest.raises(Exception, match="not configured"):
        service.get_embedding_provider()
    await service.shutdown()


@pytest.mark.asyncio
async def test_openai_embedding_factory_uses_shared_client():
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox",
        OPENAI_API_KEY="test-key",
    )
    client = create_mock_http_client()
    service = ProviderService(settings, _app_config())
    await service.startup(http_client=client)
    assert service.http_client is client
    provider = service.get_embedding_provider()
    vector = await provider.embed("hello")
    assert len(vector) == len(mock_embedding_vector("default"))
    await service.shutdown()
