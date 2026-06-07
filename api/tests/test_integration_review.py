"""Review accept/reject integration tests with mocked TMDB/OMDb."""

import pytest

from tests.conftest import requires_db
from tests.test_integration_import import (
    _import_csv,
    _wait_for_complete,
)

pytestmark = requires_db


@pytest.fixture
def pending_review(integration_client, watchlist_csv_bytes):
    created = _import_csv(integration_client, watchlist_csv_bytes)
    _wait_for_complete(integration_client, created["job_id"])

    response = integration_client.get("/api/v1/films/review-required")
    assert response.status_code == 200
    data = response.json()
    assert data["data"], "Expected at least one pending review"
    return data["data"][0]


def test_accept_review_transitions_to_enriching(integration_client, pending_review):
    response = integration_client.post(
        f"/api/v1/reviews/{pending_review['review_id']}/accept",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["review_status"] == "accepted"
    assert body["film_id"] == pending_review["film_id"]

    film_response = integration_client.get(f"/api/v1/films/{pending_review['film_id']}")
    assert film_response.status_code == 200
    assert film_response.json()["enrichment_status"] == "enriching"
    assert film_response.json()["metadata"] is not None


def test_reject_review_transitions_to_failed(integration_client):
    import uuid

    suffix = uuid.uuid4().hex[:8]
    csv_ambiguous = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-02,Ambiguous Title,1981,https://letterboxd.com/film/reject-{suffix}/\n"
    ).encode()
    created = _import_csv(integration_client, csv_ambiguous)
    _wait_for_complete(integration_client, created["job_id"])

    reviews = integration_client.get("/api/v1/films/review-required").json()["data"]
    review = next(
        (r for r in reviews if r["letterboxd_uri"].endswith(f"reject-{suffix}/")),
        reviews[0],
    )
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

    second = integration_client.post(
        f"/api/v1/reviews/{pending_review['review_id']}/accept",
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "CONFLICT"
