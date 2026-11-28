"""My services settings, the flatrate cache, and GET /films?on_my_services."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.database.enums import EnrichmentStatus, FilmStatus
from app.providers.tmdb import TmdbClient
from app.repositories import (
    film_metadata_repository,
    film_repository,
    import_job_repository,
    watchlist_repository,
)
from app.services.enrichment_pipeline import run_semantic_pipeline
from app.services.streaming_availability_service import refresh_stale_watchlist
from tests.conftest import requires_db
from tests.helpers.seed_ready_films import seed_ready_films

pytestmark = requires_db


def _titles(response) -> list[str]:
    assert response.status_code == 200, response.text
    return [row["title"] for row in response.json()["data"]]


def _seed(
    db: Session,
    *,
    title: str,
    tmdb_id: int,
    genres: list[str],
    runtime: int,
    on_watchlist: bool = True,
) -> str:
    suffix = uuid.uuid4().hex[:8]
    job = import_job_repository.create(db, total_films=1)
    film = film_repository.create(
        db,
        title=title,
        letterboxd_uri=f"https://letterboxd.com/film/{suffix}/",
        year=1999,
        import_job_id=job.id,
    )
    film.status = FilmStatus.ACTIVE
    film.enrichment_status = EnrichmentStatus.READY
    film_metadata_repository.upsert(
        db,
        film.id,
        tmdb_id=tmdb_id,
        runtime=runtime,
        genres=genres,
        metadata_source="tmdb",
    )
    if on_watchlist:
        watchlist_repository.create_active_entry(
            db,
            film_id=film.id,
            letterboxd_uri=film.letterboxd_uri,
        )
    db.commit()
    return str(film.id)


def test_streaming_services_round_trip_and_reject_bad_ids(integration_client):
    empty = integration_client.get("/api/v1/settings/services")
    assert empty.status_code == 200
    assert empty.json() == {"country_code": "GB", "provider_ids": []}

    saved = integration_client.put(
        "/api/v1/settings/services",
        json={"provider_ids": [337, 8, 8]},
    )
    assert saved.status_code == 200
    assert saved.json()["country_code"] == "GB"
    assert saved.json()["provider_ids"] == [8, 337]

    again = integration_client.get("/api/v1/settings/services")
    assert again.json()["provider_ids"] == [8, 337]

    cleared = integration_client.put("/api/v1/settings/services", json={"provider_ids": []})
    assert cleared.status_code == 200
    assert cleared.json()["provider_ids"] == []

    rejected = integration_client.put("/api/v1/settings/services", json={"provider_ids": [0]})
    assert rejected.status_code == 400
    assert rejected.json()["error"]["code"] == "VALIDATION_ERROR"


def test_catalog_lists_gb_providers_with_logos_sorted_by_priority(integration_client):
    response = integration_client.get("/api/v1/settings/services/catalog")
    assert response.status_code == 200
    body = response.json()
    assert body["country_code"] == "GB"
    names = [item["provider_name"] for item in body["providers"]]
    assert names == ["Netflix", "Prime Video", "Disney Plus"]
    netflix = body["providers"][0]
    assert netflix["provider_id"] == 8
    assert netflix["logo_url"] == "https://image.tmdb.org/t/p/w92/netflix.jpg"


async def test_enrichment_and_scheduler_fill_the_cache_used_by_the_filter(
    integration_client,
    db_session,
):
    """Watchlist films gain flatrate ids on enrichment and on the scheduler refresh."""
    enriched = seed_ready_films(db_session, count=1)[0]
    enriched.enrichment_status = EnrichmentStatus.ENRICHING
    db_session.commit()
    providers = integration_client.app.state.provider_service
    await run_semantic_pipeline(db_session, enriched.id, providers)
    db_session.commit()

    scheduled_id = _seed(
        db_session,
        title="Scheduled Film",
        tmdb_id=10050,
        genres=["Drama"],
        runtime=110,
    )
    off_list_id = _seed(
        db_session,
        title="Not On Watchlist",
        tmdb_id=10051,
        genres=["Drama"],
        runtime=110,
        on_watchlist=False,
    )
    watched_id = _seed(
        db_session,
        title="Watched Film",
        tmdb_id=10052,
        genres=["Drama"],
        runtime=110,
        on_watchlist=False,
    )
    watched = film_repository.get_by_id(db_session, uuid.UUID(watched_id))
    assert watched is not None
    watched.status = FilmStatus.WATCHED
    db_session.commit()
    updated = await refresh_stale_watchlist(providers)
    assert updated == 2

    integration_client.put("/api/v1/settings/services", json={"provider_ids": [8]})

    matched = _titles(integration_client.get("/api/v1/films?on_my_services=true&sort=title&sort_dir=asc"))
    assert enriched.title in matched
    assert "Scheduled Film" in matched
    assert "Watched Film" in matched
    assert "Not On Watchlist" not in matched

    integration_client.put("/api/v1/settings/services", json={"provider_ids": [999]})
    assert _titles(integration_client.get("/api/v1/films?on_my_services=true")) == []

    # The off-watchlist film was never cached, so it stays out even for a real provider.
    assert off_list_id
    assert scheduled_id


async def test_on_my_services_combines_with_genre_runtime_sort_and_pagination(
    integration_client,
    db_session,
):
    alpha = _seed(db_session, title="Alpha", tmdb_id=11001, genres=["Horror"], runtime=80)
    beta = _seed(db_session, title="Beta", tmdb_id=11002, genres=["Drama"], runtime=140)
    gamma = _seed(db_session, title="Gamma", tmdb_id=11003, genres=["Horror"], runtime=80)
    # Disney-only is not in the default mock. This film is cached with Netflix and Disney
    # like the others, then excluded by genre or runtime instead.
    del alpha, beta, gamma

    updated = await refresh_stale_watchlist(integration_client.app.state.provider_service)
    assert updated == 3
    integration_client.put("/api/v1/settings/services", json={"provider_ids": [8]})

    page = integration_client.get(
        "/api/v1/films?on_my_services=true&genres=horror&runtime=le_90"
        "&sort=title&sort_dir=asc&limit=1&offset=1"
    )
    assert page.status_code == 200
    body = page.json()
    assert body["pagination"]["total"] == 2
    assert body["pagination"]["has_more"] is False
    assert body["pagination"]["limit"] == 1
    assert body["pagination"]["offset"] == 1
    assert [row["title"] for row in body["data"]] == ["Gamma"]

    first = integration_client.get(
        "/api/v1/films?on_my_services=true&genres=horror&runtime=le_90"
        "&sort=title&sort_dir=asc&limit=1&offset=0"
    )
    assert [row["title"] for row in first.json()["data"]] == ["Alpha"]
    assert first.json()["pagination"]["has_more"] is True


async def test_list_filter_does_not_call_tmdb(integration_client, db_session, monkeypatch):
    _seed(db_session, title="Cached", tmdb_id=12001, genres=["Drama"], runtime=100)
    await refresh_stale_watchlist(integration_client.app.state.provider_service)
    integration_client.put("/api/v1/settings/services", json={"provider_ids": [8]})

    async def _boom(self, *args, **kwargs):
        raise AssertionError("list query called TMDB watch providers")

    monkeypatch.setattr(TmdbClient, "get_movie_watch_providers", _boom)
    monkeypatch.setattr(TmdbClient, "list_movie_watch_providers", _boom)

    response = integration_client.get("/api/v1/films?on_my_services=true")
    assert _titles(response) == ["Cached"]


async def test_opening_where_to_watch_fills_a_missing_cache(integration_client, db_session, monkeypatch):
    film_id = _seed(db_session, title="Opened", tmdb_id=13001, genres=["Drama"], runtime=100)
    integration_client.put("/api/v1/settings/services", json={"provider_ids": [337]})

    watched = integration_client.get(f"/api/v1/films/{film_id}/watch-providers")
    assert watched.status_code == 200
    flatrate = next(item for item in watched.json()["categories"] if item["type"] == "flatrate")
    assert [item["provider_name"] for item in flatrate["providers"]] == ["Disney Plus", "Netflix"]
    assert flatrate["providers"][0]["subscribed"] is True
    assert flatrate["providers"][1]["subscribed"] is False

    async def _boom(self, *args, **kwargs):
        raise AssertionError("list query called TMDB watch providers")

    monkeypatch.setattr(TmdbClient, "get_movie_watch_providers", _boom)

    assert _titles(integration_client.get("/api/v1/films?on_my_services=true")) == ["Opened"]


def test_empty_selection_matches_no_films(integration_client, db_session):
    _seed(db_session, title="Waiting", tmdb_id=14001, genres=["Drama"], runtime=100)
    response = integration_client.get("/api/v1/films?on_my_services=true")
    assert response.status_code == 200
    assert response.json()["pagination"]["total"] == 0
    assert response.json()["data"] == []
