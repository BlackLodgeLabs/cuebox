"""Manual film rematch integration tests with mocked TMDB/OMDb/OpenAI."""

import uuid

from app.database.enums import EnrichmentStatus
from app.repositories import film_repository
from tests.conftest import requires_db
from tests.integration_helpers import wait_for_film_status
from tests.mock_providers import AMBIGUOUS_TMDB_ID, MATRIX_TMDB_ID
from tests.test_integration_import import (
    _import_csv,
    _single_film_csv,
    _wait_for_review_required,
)

pytestmark = requires_db


def _rematch(client, film_id: str, tmdb_id: int) -> dict:
    response = client.post(
        f"/api/v1/films/{film_id}/rematch",
        json={"tmdb_id": tmdb_id},
    )
    assert response.status_code == 202, response.text
    return response.json()


def test_rematch_from_ready_transitions_to_ready(integration_client):
    _import_csv(integration_client, _single_film_csv())
    films = integration_client.get("/api/v1/films?limit=1").json()["data"]
    film_id = films[0]["id"]
    wait_for_film_status(integration_client, film_id, "ready")

    body = _rematch(integration_client, film_id, AMBIGUOUS_TMDB_ID)
    assert body["enrichment_status"] == "enriching"

    film = wait_for_film_status(integration_client, film_id, "ready")
    assert film["metadata"]["metadata_source"] == "tmdb_manual"
    assert film["metadata"]["match_confidence"] == 1.0
    assert film["metadata"]["tmdb_id"] == AMBIGUOUS_TMDB_ID
    assert film["semantic_profile"] is not None


def test_rematch_from_failed_transitions_to_ready(integration_client):
    suffix = uuid.uuid4().hex[:8]
    csv_ambiguous = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-02,Ambiguous Title,1981,https://letterboxd.com/film/reject-{suffix}/\n"
    ).encode()
    _import_csv(integration_client, csv_ambiguous)
    review = _wait_for_review_required(integration_client)[0]

    reject = integration_client.post(f"/api/v1/reviews/{review['review_id']}/reject")
    assert reject.status_code == 200
    assert (
        integration_client.get(f"/api/v1/films/{review['film_id']}").json()[
            "enrichment_status"
        ]
        == "failed"
    )

    _rematch(integration_client, review["film_id"], MATRIX_TMDB_ID)
    film = wait_for_film_status(integration_client, review["film_id"], "ready")
    assert film["metadata"]["metadata_source"] == "tmdb_manual"
    assert film["semantic_profile"] is not None


def test_rematch_from_review_required_reconciles_review(integration_client):
    suffix = uuid.uuid4().hex[:8]
    csv_ambiguous = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-02,Ambiguous Title,1981,https://letterboxd.com/film/rematch-review-{suffix}/\n"
    ).encode()
    _import_csv(integration_client, csv_ambiguous)
    review = _wait_for_review_required(integration_client)[0]
    film_id = review["film_id"]

    _rematch(integration_client, film_id, MATRIX_TMDB_ID)

    pending = integration_client.get("/api/v1/films/review-required").json()["data"]
    assert all(item["film_id"] != film_id for item in pending)

    film = wait_for_film_status(integration_client, film_id, "ready")
    assert film["metadata"]["tmdb_id"] == MATRIX_TMDB_ID


def test_rematch_conflict_while_enriching(integration_client, db_session):
    _import_csv(integration_client, _single_film_csv())
    films = integration_client.get("/api/v1/films?limit=1").json()["data"]
    film_id = films[0]["id"]
    film = film_repository.get_by_id(db_session, uuid.UUID(film_id))
    assert film is not None
    film_repository.update_enrichment_status(
        db_session, film, EnrichmentStatus.ENRICHING
    )
    db_session.commit()

    response = integration_client.post(
        f"/api/v1/films/{film_id}/rematch",
        json={"tmdb_id": AMBIGUOUS_TMDB_ID},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


def test_rematch_conflict_duplicate_tmdb_id(integration_client, watchlist_csv_bytes):
    _import_csv(integration_client, _single_film_csv())
    matrix_films = integration_client.get(
        "/api/v1/films?search=Matrix&limit=1"
    ).json()["data"]
    matrix_film_id = matrix_films[0]["id"]
    wait_for_film_status(integration_client, matrix_film_id, "ready")

    _import_csv(integration_client, watchlist_csv_bytes)
    review = _wait_for_review_required(integration_client)[0]

    response = integration_client.post(
        f"/api/v1/films/{review['film_id']}/rematch",
        json={"tmdb_id": MATRIX_TMDB_ID},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"
    assert "already linked" in response.json()["error"]["message"]


def test_tmdb_search_returns_results(integration_client):
    _import_csv(integration_client, _single_film_csv())
    films = integration_client.get("/api/v1/films?limit=1").json()["data"]
    film_id = films[0]["id"]

    response = integration_client.get(
        f"/api/v1/films/{film_id}/tmdb-search",
        params={"q": "The Matrix"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) >= 1
    assert data[0]["tmdb_id"] == MATRIX_TMDB_ID
    assert data[0]["title"] == "The Matrix"
    assert data[0]["poster_url"] is not None


def test_tmdb_search_not_found_film(integration_client):
    missing_id = str(uuid.uuid4())
    response = integration_client.get(
        f"/api/v1/films/{missing_id}/tmdb-search",
        params={"q": "The Matrix"},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
