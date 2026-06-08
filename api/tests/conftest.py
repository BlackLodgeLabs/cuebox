"""Shared pytest fixtures for API integration tests."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from sqlalchemy import text

from app.core.config import get_settings
from app.database.session import SessionLocal, init_engine
from app.main import create_app
from app.services.provider_service import ProviderService
from tests.mock_providers import create_mock_http_client

FIXTURES_DIR = Path(__file__).parent / "fixtures"

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    os.environ.get("DATABASE_URL", ""),
)

INTEGRATION_CONFIG_YAML = """
developer_mode: false

providers:
  metadata:
    tmdb:
      enabled: true
    omdb:
      enabled: true
  embedding:
    provider: openai
    model: text-embedding-3-small
  semantic_enrichment:
    provider: openai
    model: gpt-4o-mini
  ranking:
    provider: openai
    model: gpt-4o

recommendation:
  retrieval_candidate_limit: 100

enrichment:
  inter_film_delay_seconds: 0

scoring:
  theme_fit: 0.25
  emotional_fit: 0.20
  pacing_fit: 0.15
  complexity_fit: 0.10
  era_fit: 0.10
  obscurity_fit: 0.05
  viewing_context_fit: 0.05
  diversity_adjustment: 0.10
"""


requires_db = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL or DATABASE_URL not set",
)


@pytest.fixture(autouse=True)
def _isolate_db(request):
    """Truncate application tables between DB-backed tests for isolation."""
    if not TEST_DATABASE_URL:
        yield
        return
    # test_database uses a module-scoped session; isolation is handled per-test there
    if request.module.__name__ == "tests.test_database":
        yield
        return
    init_engine(TEST_DATABASE_URL)
    with SessionLocal() as session:
        session.execute(
            text(
                "TRUNCATE metadata_match_reviews, watchlist_entries, film_embeddings, "
                "film_semantic_profiles, film_metadata, films, import_jobs "
                "RESTART IDENTITY CASCADE"
            )
        )
        session.commit()
    yield


@pytest.fixture
def db_session():
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL or DATABASE_URL not set")
    init_engine(TEST_DATABASE_URL)
    with SessionLocal() as session:
        yield session


@pytest.fixture
def watchlist_csv_bytes() -> bytes:
    suffix = uuid.uuid4().hex[:8]
    return (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,The Matrix,1999,https://letterboxd.com/film/the-matrix-{suffix}/\n"
        f"2024-01-02,Ambiguous Title,1981,https://letterboxd.com/film/ambiguous-{suffix}/\n"
    ).encode()


@pytest.fixture
def integration_env(tmp_path, monkeypatch):
    config_path = tmp_path / "config.yaml"
    config_path.write_text(INTEGRATION_CONFIG_YAML, encoding="utf-8")
    monkeypatch.setenv("DATABASE_URL", TEST_DATABASE_URL)
    monkeypatch.setenv("TEST_DATABASE_URL", TEST_DATABASE_URL)
    monkeypatch.setenv("CONFIG_PATH", str(config_path))
    monkeypatch.setenv("TMDB_API_KEY", "test-tmdb-key")
    monkeypatch.setenv("OMDB_API_KEY", "test-omdb-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    get_settings.cache_clear()
    init_engine(TEST_DATABASE_URL)
    yield config_path
    get_settings.cache_clear()


@pytest.fixture
def mock_profile() -> str:
    return "default"


@pytest.fixture
def integration_client(integration_env, monkeypatch, mock_profile):
    original_startup = ProviderService.startup

    async def patched_startup(self, http_client=None):
        return await original_startup(
            self,
            http_client=http_client or create_mock_http_client(mock_profile),
        )

    monkeypatch.setattr(ProviderService, "startup", patched_startup)

    with TestClient(create_app()) as client:
        yield client
