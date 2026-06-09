"""Integration tests for semantic/embedding failure handling."""

import uuid

import pytest

from app.services.provider_service import ProviderService
from tests.conftest import requires_db
from tests.mock_providers import create_mock_http_client
from tests.test_integration_import import _import_csv, _wait_for_complete

pytestmark = requires_db


@pytest.fixture
def semantic_failure_client(integration_env, monkeypatch):
    original_startup = ProviderService.startup

    async def patched_startup(self, http_client=None):
        return await original_startup(
            self,
            http_client=http_client or create_mock_http_client("semantic_failure"),
        )

    monkeypatch.setattr(ProviderService, "startup", patched_startup)

    from fastapi.testclient import TestClient
    from app.main import create_app

    with TestClient(create_app()) as client:
        yield client


def test_semantic_failure_marks_film_failed(semantic_failure_client):
    suffix = uuid.uuid4().hex[:8]
    csv_content = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,The Matrix,1999,https://letterboxd.com/film/sem-fail-{suffix}/\n"
    ).encode()

    created = _import_csv(semantic_failure_client, csv_content)
    status = _wait_for_complete(semantic_failure_client, created["job_id"])

    assert status["failed_films"] == 1
    assert status["failure_summary"]
    assert any("sem-fail" in item["letterboxd_uri"] for item in status["failure_summary"])

    films = semantic_failure_client.get("/api/v1/films?limit=20").json()["data"]
    failed = next(f for f in films if f"sem-fail-{suffix}" in f["letterboxd_uri"])
    assert failed["enrichment_status"] == "failed"
