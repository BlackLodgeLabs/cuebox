"""GET /films/{film_id}/trailer — YouTube trailer from TMDB videos."""

from __future__ import annotations

import uuid

from app.database.enums import EnrichmentStatus, FilmStatus
from app.repositories import film_metadata_repository, film_repository, import_job_repository
from tests.mock_providers import MATRIX_TMDB_ID, NO_TRAILER_TMDB_ID, TRAILER_FAIL_TMDB_ID


def _film_with_tmdb(db_session, *, title: str, tmdb_id: int | None):
    job = import_job_repository.create(db_session, total_films=1)
    suffix = uuid.uuid4().hex[:8]
    film = film_repository.create(
        db_session,
        title=title,
        letterboxd_uri=f"https://letterboxd.com/film/{suffix}/",
        year=1999,
        import_job_id=job.id,
    )
    film.status = FilmStatus.ACTIVE
    film.enrichment_status = EnrichmentStatus.READY
    if tmdb_id is not None:
        film_metadata_repository.upsert(
            db_session,
            film.id,
            tmdb_id=tmdb_id,
            metadata_source="tmdb",
        )
    db_session.commit()
    return film


def test_trailer_prefers_official_youtube_trailer(integration_client, db_session):
    film = _film_with_tmdb(db_session, title="The Matrix", tmdb_id=MATRIX_TMDB_ID)

    response = integration_client.get(f"/api/v1/films/{film.id}/trailer")

    assert response.status_code == 200
    assert response.json() == {
        "url": "https://www.youtube.com/watch?v=official-trailer",
        "name": "Official Trailer",
        "site": "YouTube",
    }


def test_trailer_is_null_when_tmdb_has_no_youtube_trailer(integration_client, db_session):
    film = _film_with_tmdb(db_session, title="Silent Film", tmdb_id=NO_TRAILER_TMDB_ID)

    response = integration_client.get(f"/api/v1/films/{film.id}/trailer")

    assert response.status_code == 200
    assert response.json() == {"url": None, "name": None, "site": None}


def test_trailer_is_null_when_film_has_no_tmdb_id(integration_client, db_session):
    film = _film_with_tmdb(db_session, title="Unmatched", tmdb_id=None)

    response = integration_client.get(f"/api/v1/films/{film.id}/trailer")

    assert response.status_code == 200
    assert response.json() == {"url": None, "name": None, "site": None}


def test_trailer_tmdb_error_is_provider_error(integration_client, db_session):
    film = _film_with_tmdb(db_session, title="Broken Videos", tmdb_id=TRAILER_FAIL_TMDB_ID)

    response = integration_client.get(f"/api/v1/films/{film.id}/trailer")

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "PROVIDER_ERROR"


def test_trailer_missing_film_is_not_found(integration_client):
    response = integration_client.get(f"/api/v1/films/{uuid.uuid4()}/trailer")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
