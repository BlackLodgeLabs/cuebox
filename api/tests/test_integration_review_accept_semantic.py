"""Integration tests for review accept resuming semantic pipeline."""

import time
import uuid

from tests.conftest import requires_db
from tests.test_integration_import import _import_csv, _wait_for_review_required

pytestmark = requires_db


def _wait_for_film_ready(client, film_id: str, *, timeout: float = 30.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        response = client.get(f"/api/v1/films/{film_id}")
        assert response.status_code == 200
        payload = response.json()
        if payload["enrichment_status"] == "ready":
            return payload
        time.sleep(0.2)
    raise AssertionError(f"Film {film_id} did not reach ready within {timeout}s")


def test_accept_review_completes_to_ready_with_semantic_profile(
    integration_client, watchlist_csv_bytes
):
    _import_csv(integration_client, watchlist_csv_bytes)
    review = _wait_for_review_required(integration_client)[0]

    response = integration_client.post(f"/api/v1/reviews/{review['review_id']}/accept")
    assert response.status_code == 200

    detail = _wait_for_film_ready(integration_client, review["film_id"])
    assert detail["semantic_profile"] is not None
    assert detail["semantic_profile"]["semantic_version"] == "semantic-v1"


def test_reject_review_still_fails_without_semantic_work(integration_client):
    suffix = uuid.uuid4().hex[:8]
    csv_ambiguous = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-02,Ambiguous Title,1981,https://letterboxd.com/film/reject-sem-{suffix}/\n"
    ).encode()
    _import_csv(integration_client, csv_ambiguous)
    review = _wait_for_review_required(integration_client)[0]

    response = integration_client.post(f"/api/v1/reviews/{review['review_id']}/reject")
    assert response.status_code == 200

    film = integration_client.get(f"/api/v1/films/{review['film_id']}").json()
    assert film["enrichment_status"] == "failed"
    assert film.get("semantic_profile") is None
