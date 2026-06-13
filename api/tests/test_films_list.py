"""Tests for GET /films list and detail query parameters."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.database.enums import EnrichmentStatus, FilmStatus
from app.database.session import SessionLocal
from app.providers.semantic.base import SemanticProfileResult
from app.repositories import (
    film_metadata_repository,
    film_repository,
    import_job_repository,
    semantic_profile_repository,
    watchlist_repository,
)
from tests.conftest import requires_db
from tests.helpers.seed_ready_films import seed_ready_films
from tests.mock_providers import DEFAULT_SEMANTIC_PROFILE

pytestmark = requires_db


def _seed_watchlist_film(
    db: Session,
    *,
    title: str,
    year: int,
    enrichment_status: EnrichmentStatus = EnrichmentStatus.READY,
    on_watchlist: bool = True,
    film_status: FilmStatus = FilmStatus.ACTIVE,
    with_semantic_profile: bool | None = None,
) -> str:
    suffix = uuid.uuid4().hex[:8]
    job = import_job_repository.create(db, total_films=1)
    film = film_repository.create(
        db,
        title=title,
        letterboxd_uri=f"https://letterboxd.com/film/{suffix}/",
        year=year,
        import_job_id=job.id,
    )
    film.status = film_status
    film.enrichment_status = enrichment_status
    film_metadata_repository.upsert(
        db,
        film.id,
        tmdb_id=abs(hash(title)) % 1_000_000,
        poster_url="https://image.tmdb.org/t/p/w500/poster.jpg",
        director="Test Director",
        genres=["Drama"],
    )
    if with_semantic_profile is None:
        with_semantic_profile = enrichment_status == EnrichmentStatus.READY
    if with_semantic_profile:
        semantic_profile_repository.upsert(
            db,
            film.id,
            SemanticProfileResult(
                subgenres=DEFAULT_SEMANTIC_PROFILE["subgenres"],
                themes=DEFAULT_SEMANTIC_PROFILE["themes"],
                tones=DEFAULT_SEMANTIC_PROFILE["tones"],
                visual_descriptors=DEFAULT_SEMANTIC_PROFILE["visual_descriptors"],
                emotional_outcomes=DEFAULT_SEMANTIC_PROFILE["emotional_outcomes"],
                viewing_contexts=["solo viewing"],
                complexity=5.0,
                pacing=5.0,
                energy=5.0,
                obscurity=5.0,
                semantic_summary="A test summary.",
            ),
            semantic_version="semantic-v1",
            generated_by_model="gpt-4o-mini",
        )
    if on_watchlist:
        watchlist_repository.create_active_entry(
            db,
            film_id=film.id,
            letterboxd_uri=film.letterboxd_uri,
        )
    db.commit()
    return str(film.id)


def test_list_films_on_watchlist_excludes_inactive_entries(integration_client):
    with SessionLocal() as db:
        on_list = _seed_watchlist_film(db, title="Alpha Film", year=2001)
        _seed_watchlist_film(
            db,
            title="Beta Archived",
            year=2002,
            on_watchlist=False,
            film_status=FilmStatus.ARCHIVED,
        )

    response = integration_client.get("/api/v1/films?on_watchlist=true&limit=50")
    assert response.status_code == 200
    data = response.json()["data"]
    ids = {item["id"] for item in data}
    assert on_list in ids
    assert all(item["title"] != "Beta Archived" for item in data)


def test_list_films_search_sort_and_year_filter(integration_client):
    with SessionLocal() as db:
        _seed_watchlist_film(db, title="Zulu Dawn", year=1979)
        _seed_watchlist_film(db, title="Alpha Dog", year=2006)

    response = integration_client.get(
        "/api/v1/films?on_watchlist=true&search=alpha&year=2006&sort=title&sort_dir=asc"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["pagination"]["total"] == 1
    assert payload["data"][0]["title"] == "Alpha Dog"


def test_list_films_enrichment_status_filter(integration_client):
    with SessionLocal() as db:
        pending_id = _seed_watchlist_film(
            db,
            title="Pending Film",
            year=2010,
            enrichment_status=EnrichmentStatus.PENDING,
        )

    response = integration_client.get(
        "/api/v1/films?on_watchlist=true&enrichment_status=pending&limit=50"
    )
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["data"]}
    assert pending_id in ids


def test_list_films_invalid_sort_returns_validation_error(integration_client):
    response = integration_client.get("/api/v1/films?sort=poster")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_get_film_returns_semantic_profile_when_present(integration_client):
    with SessionLocal() as db:
        film_id = _seed_watchlist_film(
            db,
            title="Semantic Ready",
            year=1999,
            enrichment_status=EnrichmentStatus.ENRICHING,
            with_semantic_profile=True,
        )

    response = integration_client.get(f"/api/v1/films/{film_id}")
    assert response.status_code == 200
    detail = response.json()
    assert detail["enrichment_status"] == "enriching"
    assert detail["semantic_profile"] is not None
    assert detail["semantic_profile"]["semantic_summary"] == "A test summary."


def test_list_films_sort_by_title(integration_client):
    with SessionLocal() as db:
        seed_ready_films(db, count=3)
    response = integration_client.get(
        "/api/v1/films?on_watchlist=true&sort=title&sort_dir=asc&limit=10"
    )
    assert response.status_code == 200
    titles = [item["title"] for item in response.json()["data"]]
    assert titles == sorted(titles)
