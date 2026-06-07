"""Health endpoint tests."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app

CONFIG_YAML = """
developer_mode: false

providers:
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


@pytest.fixture
def client(tmp_path, monkeypatch):
    config_path = tmp_path / "config.yaml"
    config_path.write_text(CONFIG_YAML, encoding="utf-8")

    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")
    monkeypatch.setenv("CONFIG_PATH", str(config_path))
    get_settings.cache_clear()

    with TestClient(create_app()) as test_client:
        yield test_client

    get_settings.cache_clear()


def test_health_returns_ok_shape(client):
    with patch("app.routers.v1.health.check_database", return_value=True):
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "ok"
    assert data["version"] == "1.0.0"
    assert set(data["providers"].keys()) == {
        "embedding",
        "semantic_enrichment",
        "ranking",
    }
    assert all(value in ("ok", "error") for value in data["providers"].values())


def test_health_database_error(client):
    with patch("app.routers.v1.health.check_database", return_value=False):
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["database"] == "error"


def test_health_provider_keys_missing(client):
    with patch("app.routers.v1.health.check_database", return_value=True):
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    providers = response.json()["providers"]
    assert all(value == "error" for value in providers.values())


LOCAL_PROVIDERS_CONFIG_YAML = """
developer_mode: false

providers:
  embedding:
    provider: voyage
    model: voyage-3
  semantic_enrichment:
    provider: ollama
    model: llama3
  ranking:
    provider: lm_studio
    model: local-model

recommendation:
  retrieval_candidate_limit: 100

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


@pytest.fixture
def local_providers_client(tmp_path, monkeypatch):
    config_path = tmp_path / "config.yaml"
    config_path.write_text(LOCAL_PROVIDERS_CONFIG_YAML, encoding="utf-8")

    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")
    monkeypatch.setenv("CONFIG_PATH", str(config_path))
    get_settings.cache_clear()

    with TestClient(create_app()) as test_client:
        yield test_client

    get_settings.cache_clear()


def test_health_local_providers_without_env_keys(local_providers_client):
    with patch("app.routers.v1.health.check_database", return_value=True):
        response = local_providers_client.get("/api/v1/health")

    assert response.status_code == 200
    providers = response.json()["providers"]
    assert all(value == "ok" for value in providers.values())
