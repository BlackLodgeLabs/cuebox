"""Integration tests for recommendation history endpoints."""

import time

from tests.conftest import requires_db
from tests.helpers.seed_ready_films import DEFAULT_QUESTIONNAIRE, seed_ready_films

pytestmark = requires_db


def test_history_list_and_detail(integration_client, db_session):
    seed_ready_films(db_session, count=5)
    created = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE},
    ).json()
    session_id = created["session_id"]

    started = time.monotonic()
    history = integration_client.get("/api/v1/recommendations?limit=10").json()
    elapsed = time.monotonic() - started
    assert elapsed < 2.0, f"GET /recommendations took {elapsed:.2f}s (target < 2s)"
    assert history["pagination"]["total"] >= 1
    assert any(item["session_id"] == session_id for item in history["data"])

    detail = integration_client.get(f"/api/v1/recommendations/{session_id}").json()
    assert detail["profile_summary"] is not None
    assert detail["profile_summary"]["structured_profile"]
    assert detail["winner"]["title"]


def test_insufficient_candidates(integration_client, db_session):
    response = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INSUFFICIENT_CANDIDATES"
