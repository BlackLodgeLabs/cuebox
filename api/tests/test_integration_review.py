"""Review accept/reject integration tests with mocked TMDB/OMDb/OpenAI."""

import time

import pytest

from tests.conftest import requires_db
from tests.test_integration_import import (
    _import_csv,
    _wait_for_review_required,
)

pytestmark = requires_db


@pytest.fixture
def pending_review(integration_client, watchlist_csv_bytes):
    _import_csv(integration_client, watchlist_csv_bytes)
    return _wait_for_review_required(integration_client)[0]


def _wait_for_film_status(client, film_id: str, status: str, *, timeout: float = 30.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        response = client.get(f"/api/v1/films/{film_id}")
        assert response.status_code == 200
        payload = response.json()
        if payload["enrichment_status"] == status:
            return payload
        time.sleep(0.2)
    raise AssertionError(f"Film {film_id} did not reach {status} within {timeout}s")


def test_accept_review_transitions_to_ready(integration_client, pending_review):
    response = integration_client.post(
        f"/api/v1/reviews/{pending_review['review_id']}/accept",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["review_status"] == "accepted"
    assert body["film_id"] == pending_review["film_id"]

    film = _wait_for_film_status(integration_client, pending_review["film_id"], "ready")
    assert film["metadata"] is not None
    assert film["semantic_profile"] is not None


def test_reject_review_transitions_to_failed(integration_client):
    import uuid

    suffix = uuid.uuid4().hex[:8]
    csv_ambiguous = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-02,Ambiguous Title,1981,https://letterboxd.com/film/reject-{suffix}/\n"
    ).encode()
    _import_csv(integration_client, csv_ambiguous)
    review = _wait_for_review_required(integration_client)[0]

    response = integration_client.post(f"/api/v1/reviews/{review['review_id']}/reject")
    assert response.status_code == 200
    assert response.json()["review_status"] == "rejected"

    film_response = integration_client.get(f"/api/v1/films/{review['film_id']}")
    assert film_response.json()["enrichment_status"] == "failed"


def test_accept_review_conflict_when_already_resolved(integration_client, pending_review):
    first = integration_client.post(
        f"/api/v1/reviews/{pending_review['review_id']}/accept",
    )
    assert first.status_code == 200
    _wait_for_film_status(integration_client, pending_review["film_id"], "ready")

    second = integration_client.post(
        f"/api/v1/reviews/{pending_review['review_id']}/accept",
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "CONFLICT"
