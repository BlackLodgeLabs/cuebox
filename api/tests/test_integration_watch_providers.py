"""Integration tests for GET /films/{film_id}/watch-providers."""

from __future__ import annotations

import uuid

from app.database.enums import EnrichmentStatus, FilmStatus
from app.repositories import film_metadata_repository, film_repository, import_job_repository
from tests.helpers.seed_ready_films import seed_ready_films
from tests.mock_providers import (
    EMPTY_GB_TMDB_ID,
    MATRIX_TMDB_ID,
    WATCH_PROVIDER_FAIL_TMDB_ID,
)


def test_watch_providers_returns_gb_categories(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film_id = str(films[0].id)

    response = integration_client.get(f"/api/v1/films/{film_id}/watch-providers")
    assert response.status_code == 200
    body = response.json()
    assert body["film_id"] == film_id
    assert body["country_code"] == "GB"
    assert body["tmdb_id"] == 10000
    types = {category["type"] for category in body["categories"]}
    assert types == {"flatrate", "rent", "buy", "ads"}
    flatrate = next(c for c in body["categories"] if c["type"] == "flatrate")
    assert flatrate["label"] == "Stream"
    assert flatrate["providers"][0]["provider_name"] == "Netflix"
    assert flatrate["providers"][0]["logo_url"].startswith("https://image.tmdb.org/t/p/w92/")


def test_watch_providers_not_found(integration_client):
    missing_id = str(uuid.uuid4())
    response = integration_client.get(f"/api/v1/films/{missing_id}/watch-providers")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_watch_providers_no_tmdb_id(integration_client, db_session):
    job = import_job_repository.create(db_session, total_films=1)
    film = film_repository.create(
        db_session,
        title="Unmatched Film",
        letterboxd_uri="https://letterboxd.com/film/unmatched/",
        year=2000,
        import_job_id=job.id,
    )
    film.status = FilmStatus.ACTIVE
    film.enrichment_status = EnrichmentStatus.REVIEW_REQUIRED
    db_session.commit()

    response = integration_client.get(f"/api/v1/films/{film.id}/watch-providers")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNPROCESSABLE"
    assert "Match TMDB metadata" in response.json()["error"]["message"]


def test_watch_providers_empty_gb(integration_client, db_session):
    job = import_job_repository.create(db_session, total_films=1)
    film = film_repository.create(
        db_session,
        title="Empty Providers Film",
        letterboxd_uri="https://letterboxd.com/film/empty-providers/",
        year=2010,
        import_job_id=job.id,
    )
    film.status = FilmStatus.ACTIVE
    film.enrichment_status = EnrichmentStatus.READY
    film_metadata_repository.upsert(
        db_session,
        film.id,
        tmdb_id=EMPTY_GB_TMDB_ID,
        metadata_source="tmdb",
    )
    db_session.commit()

    response = integration_client.get(f"/api/v1/films/{film.id}/watch-providers")
    assert response.status_code == 200
    assert response.json()["categories"] == []


def test_watch_providers_tmdb_error(integration_client, db_session):
    job = import_job_repository.create(db_session, total_films=1)
    film = film_repository.create(
        db_session,
        title="Provider Fail Film",
        letterboxd_uri="https://letterboxd.com/film/provider-fail/",
        year=2011,
        import_job_id=job.id,
    )
    film.status = FilmStatus.ACTIVE
    film.enrichment_status = EnrichmentStatus.READY
    film_metadata_repository.upsert(
        db_session,
        film.id,
        tmdb_id=WATCH_PROVIDER_FAIL_TMDB_ID,
        metadata_source="tmdb",
    )
    db_session.commit()

    response = integration_client.get(f"/api/v1/films/{film.id}/watch-providers")
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "PROVIDER_ERROR"


def test_watch_providers_matrix_fixture(integration_client, db_session):
    """MATRIX_TMDB_ID uses the canonical mock fixture."""
    job = import_job_repository.create(db_session, total_films=1)
    film = film_repository.create(
        db_session,
        title="The Matrix",
        letterboxd_uri="https://letterboxd.com/film/the-matrix/",
        year=1999,
        import_job_id=job.id,
    )
    film.status = FilmStatus.ACTIVE
    film.enrichment_status = EnrichmentStatus.READY
    film_metadata_repository.upsert(
        db_session,
        film.id,
        tmdb_id=MATRIX_TMDB_ID,
        metadata_source="tmdb",
    )
    db_session.commit()

    response = integration_client.get(f"/api/v1/films/{film.id}/watch-providers")
    assert response.status_code == 200
    body = response.json()
    assert body["tmdb_id"] == MATRIX_TMDB_ID
    assert len(body["categories"]) >= 1
