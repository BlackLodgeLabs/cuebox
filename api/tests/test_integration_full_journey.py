"""End-to-end API journey: import → enrich → recommend → history."""

import time

from tests.conftest import requires_db
from tests.helpers.seed_ready_films import DEFAULT_QUESTIONNAIRE
from tests.test_integration_import import (
    _import_csv,
    _single_film_csv,
    _wait_for_complete,
    _wait_for_review_required,
)

pytestmark = requires_db


def _accept_pending_reviews(client) -> None:
    response = client.get("/api/v1/films/review-required")
    assert response.status_code == 200, response.text
    reviews = response.json().get("data", [])
    for review in reviews:
        response = client.post(f"/api/v1/reviews/{review['review_id']}/accept")
        assert response.status_code == 200, response.text
        film_id = review["film_id"]
        deadline = time.monotonic() + 30.0
        while time.monotonic() < deadline:
            film = client.get(f"/api/v1/films/{film_id}").json()
            if film["enrichment_status"] == "ready":
                break
            time.sleep(0.2)
        else:
            raise AssertionError(f"Film {film_id} did not reach ready after review accept")


def test_import_enrich_recommend_history_journey(integration_client):
    created = _import_csv(integration_client, _single_film_csv())
    status = _wait_for_complete(integration_client, created["job_id"])
    assert status["processed_films"] >= 1

    _accept_pending_reviews(integration_client)

    recommend = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE, "notes": "Full journey"},
    )
    assert recommend.status_code == 200, recommend.text
    body = recommend.json()
    session_id = body["session_id"]
    assert body["winner"]["title"]
    assert body["profile_cache_hit"] is False

    history = integration_client.get("/api/v1/recommendations?limit=10").json()
    assert history["pagination"]["total"] >= 1
    assert any(item["session_id"] == session_id for item in history["data"])

    detail = integration_client.get(f"/api/v1/recommendations/{session_id}").json()
    assert detail["winner"]["title"]
    assert detail["profile_summary"] is not None
    assert detail["profile_summary"]["structured_profile"]
    assert detail["profile_cache_hit"] is False
