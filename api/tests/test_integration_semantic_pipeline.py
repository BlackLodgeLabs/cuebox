"""Integration tests for full import pipeline through semantic enrichment."""

import uuid

from sqlalchemy import text

from app.database.session import SessionLocal
from tests.conftest import requires_db
from tests.test_integration_import import _import_csv, _wait_for_complete

pytestmark = requires_db


def _single_film_csv() -> bytes:
    suffix = uuid.uuid4().hex[:8]
    return (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,The Matrix,1999,https://letterboxd.com/film/matrix-{suffix}/\n"
    ).encode()


def test_import_pipeline_reaches_ready(integration_client):
    created = _import_csv(integration_client, _single_film_csv())
    status = _wait_for_complete(integration_client, created["job_id"])

    assert status["processed_films"] == 1
    assert status["failed_films"] == 0

    films = integration_client.get("/api/v1/films?limit=10").json()["data"]
    assert any(f["enrichment_status"] == "ready" for f in films)


def test_semantic_profile_and_embedding_persisted(integration_client):
    created = _import_csv(integration_client, _single_film_csv())
    _wait_for_complete(integration_client, created["job_id"])

    films = integration_client.get("/api/v1/films?enrichment_status=ready&limit=10").json()["data"]
    assert films
    film_id = films[0]["id"]

    detail = integration_client.get(f"/api/v1/films/{film_id}").json()
    assert detail["semantic_profile"] is not None
    assert detail["semantic_profile"]["semantic_version"] == "semantic-v1"
    assert detail["semantic_profile"]["semantic_summary"]

    with SessionLocal() as db:
        profile_count = db.execute(
            text("SELECT count(*) FROM film_semantic_profiles WHERE film_id = :id"),
            {"id": film_id},
        ).scalar_one()
        embedding_count = db.execute(
            text(
                "SELECT count(*) FROM film_embeddings "
                "WHERE film_id = :id AND embedding_type = 'semantic'"
            ),
            {"id": film_id},
        ).scalar_one()
    assert profile_count == 1
    assert embedding_count == 1


def test_job_counters_match_terminal_states(integration_client):
    created = _import_csv(integration_client, _single_film_csv())
    status = _wait_for_complete(integration_client, created["job_id"])
    assert status["processed_films"] <= status["total_films"]
    assert status["processed_films"] == status["total_films"] - status.get("duplicate_films", 0)
