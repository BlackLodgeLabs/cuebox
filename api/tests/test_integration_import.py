"""Import API integration tests with mocked TMDB/OMDb/OpenAI."""

import time
import uuid

from tests.conftest import requires_db

pytestmark = requires_db


def _import_csv(client, content: bytes) -> dict:
    response = client.post(
        "/api/v1/import",
        files={"file": ("watchlist.csv", content, "text/csv")},
    )
    assert response.status_code == 202, response.text
    return response.json()


def _wait_for_complete(client, job_id: str, *, timeout: float = 30.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        response = client.get(f"/api/v1/import/{job_id}/status")
        assert response.status_code == 200
        payload = response.json()
        if payload["status"] == "complete":
            return payload
        time.sleep(0.2)
    raise AssertionError(f"Import job {job_id} did not complete within {timeout}s")


def _wait_for_review_required(client, *, min_count: int = 1, timeout: float = 30.0) -> list:
    deadline = time.time() + timeout
    while time.time() < deadline:
        response = client.get("/api/v1/films/review-required")
        assert response.status_code == 200
        data = response.json()["data"]
        if len(data) >= min_count:
            return data
        time.sleep(0.2)
    raise AssertionError(f"Expected at least {min_count} review-required films within {timeout}s")


def _single_film_csv() -> bytes:
    suffix = uuid.uuid4().hex[:8]
    return (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,The Matrix,1999,https://letterboxd.com/film/single-{suffix}/\n"
    ).encode()


def test_import_returns_job_immediately(integration_client, watchlist_csv_bytes):
    started = time.monotonic()
    response = integration_client.post(
        "/api/v1/import",
        files={"file": ("watchlist.csv", watchlist_csv_bytes, "text/csv")},
    )
    elapsed = time.monotonic() - started
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "running"
    assert "job_id" in data
    assert "created_at" in data
    assert elapsed < 1.5, f"POST /import took {elapsed:.2f}s (target < 1s)"


def test_import_pipeline_completes_with_accurate_counts(integration_client):
    created = _import_csv(integration_client, _single_film_csv())
    status = _wait_for_complete(integration_client, created["job_id"])

    assert status["total_films"] == 1
    assert status["processed_films"] == 1
    assert status["duplicate_films"] == 0
    assert status["completed_at"] is not None


def test_import_invalid_csv_returns_error(integration_client):
    response = integration_client.post(
        "/api/v1/import",
        files={"file": ("bad.csv", b"Title,Year\nFoo,2000\n", "text/csv")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_CSV_FORMAT"


def test_import_status_not_found(integration_client):
    missing_id = uuid.uuid4()
    response = integration_client.get(f"/api/v1/import/{missing_id}/status")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_films_list_after_import(integration_client, watchlist_csv_bytes):
    _import_csv(integration_client, watchlist_csv_bytes)
    _wait_for_review_required(integration_client)

    response = integration_client.get("/api/v1/films?limit=50")
    assert response.status_code == 200
    data = response.json()
    assert data["pagination"]["total"] >= 2
    statuses = {item["enrichment_status"] for item in data["data"]}
    assert statuses.intersection({"ready", "review_required", "failed"})


def test_review_required_lists_low_confidence_match(integration_client, watchlist_csv_bytes):
    _import_csv(integration_client, watchlist_csv_bytes)
    data = _wait_for_review_required(integration_client)

    assert len(data) >= 1
    item = data[0]
    assert "review_id" in item
    assert "candidate_payload" in item
    assert "confidence_score" in item
    assert item["candidate_payload"]["tmdb_id"]


def test_failed_film_retry_on_reimport(integration_client):
    suffix = uuid.uuid4().hex[:8]
    uri = f"https://letterboxd.com/film/retry-only-{suffix}/"
    csv_once = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,Unknown Film,2020,{uri}\n"
    ).encode()

    created = _import_csv(integration_client, csv_once)
    status = _wait_for_complete(integration_client, created["job_id"])
    assert status["failed_films"] == 1

    created_retry = _import_csv(integration_client, csv_once)
    retry_status = _wait_for_complete(integration_client, created_retry["job_id"])
    assert retry_status["duplicate_films"] == 0
    assert retry_status["total_films"] == 1
