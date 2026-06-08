"""Review endpoint guard integration tests."""

from __future__ import annotations

import time
import uuid

from sqlalchemy import select

from app.database.enums import ReviewStatus
from app.database.models import MetadataMatchReview
from app.database.session import SessionLocal
from tests.conftest import requires_db
from tests.test_integration_import import _import_csv, _wait_for_complete, _wait_for_review_required

pytestmark = requires_db


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


def test_reject_non_review_required_returns_409(integration_client, watchlist_csv_bytes):
    _import_csv(integration_client, watchlist_csv_bytes)
    review = _wait_for_review_required(integration_client)[0]

    accept = integration_client.post(f"/api/v1/reviews/{review['review_id']}/accept")
    assert accept.status_code == 200
    _wait_for_film_status(integration_client, review["film_id"], "ready")

    reject = integration_client.post(f"/api/v1/reviews/{review['review_id']}/reject")
    assert reject.status_code == 409
    assert reject.json()["error"]["code"] == "CONFLICT"


def test_reject_on_ready_film_with_pending_review_returns_409(integration_client):
    """accept_flag match: film reaches ready but retains a pending review record."""
    suffix = uuid.uuid4().hex[:8]
    uri = f"https://letterboxd.com/film/enriching-{suffix}/"
    csv_content = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,The Matrix,1998,{uri}\n"
    ).encode()

    created = _import_csv(integration_client, csv_content)
    _wait_for_complete(integration_client, created["job_id"])

    film = integration_client.get("/api/v1/films?limit=50").json()["data"]
    film = next(item for item in film if item["letterboxd_uri"] == uri)
    assert film["enrichment_status"] == "ready"

    with SessionLocal() as db:
        review_id = db.scalar(
            select(MetadataMatchReview.id).where(
                MetadataMatchReview.film_id == film["id"],
                MetadataMatchReview.review_status == ReviewStatus.PENDING,
            )
        )
    assert review_id is not None, "Expected accept_flag film to retain a pending review record"

    reject = integration_client.post(f"/api/v1/reviews/{review_id}/reject")
    assert reject.status_code == 409
    assert reject.json()["error"]["code"] == "CONFLICT"

    refreshed = integration_client.get(f"/api/v1/films/{film['id']}").json()
    assert refreshed["enrichment_status"] == "ready"
