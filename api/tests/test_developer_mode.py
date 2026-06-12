"""Integration tests for Developer Mode endpoints."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app
from app.services.provider_service import ProviderService
from tests.conftest import INTEGRATION_CONFIG_YAML, requires_db
from tests.helpers.seed_ready_films import DEFAULT_QUESTIONNAIRE, seed_ready_films
from tests.mock_providers import create_mock_http_client

pytestmark = requires_db

DEV_MODE_CONFIG_YAML = INTEGRATION_CONFIG_YAML.replace(
    "developer_mode: false",
    "developer_mode: true",
)

def _create_recommendation(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE, "notes": "Dev mode trace"},
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def dev_mode_client(integration_env, monkeypatch):
    integration_env.write_text(DEV_MODE_CONFIG_YAML, encoding="utf-8")
    get_settings.cache_clear()

    original_startup = ProviderService.startup

    async def patched_startup(self, http_client=None):
        return await original_startup(
            self,
            http_client=http_client or create_mock_http_client("default"),
        )

    monkeypatch.setattr(ProviderService, "startup", patched_startup)

    with TestClient(create_app()) as client:
        yield client

    get_settings.cache_clear()
    integration_env.write_text(INTEGRATION_CONFIG_YAML, encoding="utf-8")


def test_dev_endpoints_return_404_when_disabled(integration_client, db_session):
    seed_ready_films(db_session, count=3)
    body = _create_recommendation(integration_client)
    session_id = body["session_id"]
    film_id = body["winner"]["film_id"]

    disabled_paths = [
        f"/api/v1/dev/recommendations/{session_id}/retrieval",
        f"/api/v1/dev/recommendations/{session_id}/scoring",
        f"/api/v1/dev/recommendations/{session_id}/ai",
        f"/api/v1/dev/films/{film_id}/match",
        "/api/v1/dev/system/versions",
    ]
    for path in disabled_paths:
        response = integration_client.get(path)
        assert response.status_code == 404, path


def test_dev_endpoints_return_trace_when_enabled(dev_mode_client, db_session):
    seed_ready_films(db_session, count=5)
    body = _create_recommendation(dev_mode_client)
    session_id = body["session_id"]
    film_id = body["winner"]["film_id"]

    retrieval = dev_mode_client.get(f"/api/v1/dev/recommendations/{session_id}/retrieval")
    assert retrieval.status_code == 200, retrieval.text
    retrieval_body = retrieval.json()
    assert retrieval_body["session_id"] == session_id
    assert retrieval_body["profile"]["profile_hash"]
    assert retrieval_body["candidates"]
    assert retrieval_body["candidates_returned"] == len(retrieval_body["candidates"])
    assert retrieval_body["retrieval_candidate_limit"] == 100

    scoring = dev_mode_client.get(f"/api/v1/dev/recommendations/{session_id}/scoring")
    assert scoring.status_code == 200, scoring.text
    scoring_body = scoring.json()
    assert scoring_body["weights"]["theme_fit"] == 0.25
    assert scoring_body["candidates"]
    assert scoring_body["candidates"][0]["score_breakdown"]

    ai = dev_mode_client.get(f"/api/v1/dev/recommendations/{session_id}/ai")
    assert ai.status_code == 200, ai.text
    ai_body = ai.json()
    assert ai_body["semantic_enrichment"]["provider"] == "openai"
    assert ai_body["embedding"]["model"] == "text-embedding-3-small"
    assert ai_body["ranking"]["tokens_input"] == 120
    assert ai_body["ranking"]["tokens_output"] == 80

    match = dev_mode_client.get(f"/api/v1/dev/films/{film_id}/match")
    assert match.status_code == 200, match.text
    match_body = match.json()
    assert match_body["film_id"] == film_id
    assert match_body["enrichment_status"] == "ready"

    versions = dev_mode_client.get("/api/v1/dev/system/versions")
    assert versions.status_code == 200, versions.text
    versions_body = versions.json()
    assert versions_body["versions"]
    assert all(entry["active"] for entry in versions_body["versions"])


def test_dev_session_not_found_when_enabled(dev_mode_client):
    missing_id = uuid.uuid4()
    response = dev_mode_client.get(f"/api/v1/dev/recommendations/{missing_id}/retrieval")
    assert response.status_code == 404


def test_dev_film_not_found_when_enabled(dev_mode_client):
    missing_id = uuid.uuid4()
    response = dev_mode_client.get(f"/api/v1/dev/films/{missing_id}/match")
    assert response.status_code == 404
