"""Unit tests for semantic provider resolution and parsing."""

import json

import httpx
import pytest

from app.core.config import AppConfig, EnrichmentConfig, ProviderConfig, ProvidersConfig, RecommendationConfig, ScoringConfig
from app.core.config import Settings
from app.providers.semantic.base import SemanticEnrichmentContext
from app.providers.semantic.ollama import OllamaSemanticProvider
from app.providers.semantic.openai import OpenAISemanticProvider, SemanticParseError, _parse_profile_json
from app.services.provider_service import ProviderService
from tests.mock_providers import DEFAULT_SEMANTIC_PROFILE, create_mock_http_client


def _app_config(
    *,
    semantic_provider: str = "openai",
    embedding_provider: str = "openai",
) -> AppConfig:
    return AppConfig(
        developer_mode=False,
        providers=ProvidersConfig(
            embedding=ProviderConfig(provider=embedding_provider, model="text-embedding-3-small"),
            semantic_enrichment=ProviderConfig(provider=semantic_provider, model="gpt-4o-mini"),
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
async def test_openai_semantic_provider_parses_json():
    client = create_mock_http_client()
    provider = OpenAISemanticProvider(client, "test-key", model="gpt-4o-mini")
    context = SemanticEnrichmentContext(
        title="The Matrix",
        year=1999,
        synopsis="Synopsis",
        genres=["Action"],
        keywords=["reality"],
        director="Director",
    )
    result = await provider.enrich(context)
    assert result.themes == DEFAULT_SEMANTIC_PROFILE["themes"]
    assert result.complexity == DEFAULT_SEMANTIC_PROFILE["complexity"]
    await client.aclose()


@pytest.mark.asyncio
async def test_ollama_semantic_provider_requires_no_api_key():
    client = create_mock_http_client()
    provider = OllamaSemanticProvider(client, "http://localhost:11434", model="llama3")
    context = SemanticEnrichmentContext(
        title="The Matrix",
        year=1999,
        synopsis="Synopsis",
        genres=["Action"],
        keywords=["reality"],
        director=None,
    )
    result = await provider.enrich(context)
    assert result.semantic_summary == DEFAULT_SEMANTIC_PROFILE["semantic_summary"]
    await client.aclose()


@pytest.mark.asyncio
async def test_openai_provider_factory_requires_api_key():
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox",
        OPENAI_API_KEY=None,
    )
    service = ProviderService(settings, _app_config())
    await service.startup(http_client=httpx.AsyncClient())
    with pytest.raises(Exception, match="not configured"):
        service.get_semantic_provider()
    await service.shutdown()


@pytest.mark.asyncio
async def test_ollama_provider_factory_without_openai_key():
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox",
        OPENAI_API_KEY=None,
    )
    service = ProviderService(settings, _app_config(semantic_provider="ollama"))
    await service.startup(http_client=create_mock_http_client())
    provider = service.get_semantic_provider()
    assert isinstance(provider, OllamaSemanticProvider)
    await service.shutdown()


def test_parse_profile_rejects_invalid_json():
    with pytest.raises(SemanticParseError):
        _parse_profile_json("not json")


def test_parse_profile_rejects_out_of_range_score():
    payload = dict(DEFAULT_SEMANTIC_PROFILE)
    payload["complexity"] = 11
    with pytest.raises(SemanticParseError):
        _parse_profile_json(json.dumps(payload))
