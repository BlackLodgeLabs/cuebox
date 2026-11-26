"""GET /films/tmdb/{tmdb_id} — lighter page for a film that may not be on the watchlist."""

from __future__ import annotations

import uuid

from app.database.enums import EnrichmentStatus, FilmStatus
from app.repositories import film_metadata_repository, film_repository, import_job_repository
from tests.mock_providers import MATRIX_TMDB_ID, TMDB_DETAILS_FAIL_TMDB_ID

_MATRIX_PAGE = {
    "tmdb_id": MATRIX_TMDB_ID,
    "title": "The Matrix",
    "year": 1999,
    "overview": "A computer hacker learns about the true nature of reality.",
    "backdrop_url": "https://image.tmdb.org/t/p/w780/backdrop.jpg",
    "poster_url": "https://image.tmdb.org/t/p/w500/poster.jpg",
    "genres": ["Action", "Science Fiction"],
    "runtime": 136,
    "director": "Lana Wachowski",
    "tmdb_rating": 8.7,
    "trailer_url": "https://www.youtube.com/watch?v=official-trailer",
    "film_id": None,
    "status": None,
}


def test_tmdb_film_page_returns_details_and_trailer_when_not_in_cuebox(integration_client):
    response = integration_client.get(f"/api/v1/films/tmdb/{MATRIX_TMDB_ID}")

    assert response.status_code == 200
    assert response.json() == _MATRIX_PAGE


def test_tmdb_film_page_includes_existing_cuebox_film(integration_client, db_session):
    job = import_job_repository.create(db_session, total_films=1)
    film = film_repository.create(
        db_session,
        title="The Matrix",
        letterboxd_uri=f"https://letterboxd.com/film/the-matrix-{uuid.uuid4().hex[:8]}/",
        year=1999,
        import_job_id=job.id,
    )
    film.status = FilmStatus.WATCHED
    film.enrichment_status = EnrichmentStatus.READY
    film_metadata_repository.upsert(
        db_session,
        film.id,
        tmdb_id=MATRIX_TMDB_ID,
        metadata_source="tmdb",
    )
    db_session.commit()

    response = integration_client.get(f"/api/v1/films/tmdb/{MATRIX_TMDB_ID}")

    assert response.status_code == 200
    body = response.json()
    assert body["film_id"] == str(film.id)
    assert body["status"] == "watched"
    assert body["title"] == "The Matrix"
    assert body["trailer_url"] == "https://www.youtube.com/watch?v=official-trailer"


def test_tmdb_film_page_provider_error(integration_client):
    response = integration_client.get(f"/api/v1/films/tmdb/{TMDB_DETAILS_FAIL_TMDB_ID}")

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "PROVIDER_ERROR"


def test_tmdb_film_page_unknown_movie_is_not_found(integration_client):
    response = integration_client.get("/api/v1/films/tmdb/424242")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
