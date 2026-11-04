"""Tests for GET /films list and detail query parameters."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.enums import EnrichmentStatus, FilmStatus, WatchSource
from app.database.models import Film, FilmWatch
from app.database.session import SessionLocal
from app.providers.semantic.base import SemanticProfileResult
from app.repositories import (
    film_metadata_repository,
    film_repository,
    film_watch_repository,
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
    tmdb_id: int | None = None,
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
        tmdb_id=abs(hash(title)) % 1_000_000 if tmdb_id is None else tmdb_id,
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


def test_list_films_includes_tmdb_id(integration_client):
    with SessionLocal() as db:
        film_id = _seed_watchlist_film(db, title="Tmdb Id Film", year=2001)

    response = integration_client.get("/api/v1/films?search=Tmdb%20Id%20Film&limit=5")
    assert response.status_code == 200
    item = next(row for row in response.json()["data"] if row["id"] == film_id)
    assert item["tmdb_id"] == abs(hash("Tmdb Id Film")) % 1_000_000


def test_list_films_statuses_exact_set_excludes_archived(integration_client):
    with SessionLocal() as db:
        active_id = _seed_watchlist_film(db, title="Statuses Active", year=2001)
        pending_id = _seed_watchlist_film(
            db,
            title="Statuses Pending",
            year=2002,
            film_status=FilmStatus.PENDING_WATCH_REVIEW,
            on_watchlist=False,
        )
        watched_id = _seed_watchlist_film(
            db,
            title="Statuses Watched",
            year=2003,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        _seed_watchlist_film(
            db,
            title="Statuses Archived",
            year=2004,
            film_status=FilmStatus.ARCHIVED,
            on_watchlist=False,
        )

    response = integration_client.get(
        "/api/v1/films?statuses=active,pending_watch_review,watched"
        "&search=Statuses&limit=50&sort=title&sort_dir=asc"
    )
    assert response.status_code == 200
    payload = response.json()
    ids = {item["id"] for item in payload["data"]}
    assert ids == {active_id, pending_id, watched_id}
    assert all(item["title"] != "Statuses Archived" for item in payload["data"])
    assert all(item["tmdb_id"] is not None for item in payload["data"])


def test_list_films_statuses_and_status_conflict(integration_client):
    response = integration_client.get(
        "/api/v1/films?status=active&statuses=active,watched"
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_list_films_statuses_invalid_token(integration_client):
    response = integration_client.get("/api/v1/films?statuses=active,nope")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_list_films_statuses_empty_rejected(integration_client):
    response = integration_client.get("/api/v1/films?statuses=")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_list_films_statuses_coexists_with_search(integration_client):
    with SessionLocal() as db:
        match_id = _seed_watchlist_film(db, title="Picker Match", year=1999)
        _seed_watchlist_film(db, title="Other Title", year=2000)

    response = integration_client.get(
        "/api/v1/films?statuses=active,pending_watch_review,watched"
        "&search=Picker&limit=20"
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["id"] == match_id


def test_date_watched_sort_lists_newest_first_and_keeps_dateless_films_last(
    integration_client,
):
    with SessionLocal() as db:
        newer_id = _seed_watchlist_film(
            db,
            title="Newer Watch",
            year=2024,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        older_id = _seed_watchlist_film(
            db,
            title="Older Watch",
            year=2020,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        _seed_watchlist_film(
            db,
            title="No Watch Date",
            year=1999,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(newer_id),
            source=WatchSource.MANUAL,
            watched_at=date(2024, 6, 1),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(older_id),
            source=WatchSource.MANUAL,
            watched_at=date(2020, 1, 1),
        )
        db.commit()

    response = integration_client.get(
        "/api/v1/films?status=watched&sort=watched_at&sort_dir=desc"
    )
    assert response.status_code == 200
    assert [item["title"] for item in response.json()["data"]] == [
        "Newer Watch",
        "Older Watch",
        "No Watch Date",
    ]


def test_date_watched_sort_lists_oldest_first_and_keeps_dateless_films_last(
    integration_client,
):
    with SessionLocal() as db:
        newer_id = _seed_watchlist_film(
            db,
            title="Newer Watch",
            year=2024,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        older_id = _seed_watchlist_film(
            db,
            title="Older Watch",
            year=2020,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        _seed_watchlist_film(
            db,
            title="No Watch Date",
            year=1999,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(newer_id),
            source=WatchSource.MANUAL,
            watched_at=date(2024, 6, 1),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(older_id),
            source=WatchSource.MANUAL,
            watched_at=date(2020, 1, 1),
        )
        db.commit()

    response = integration_client.get(
        "/api/v1/films?status=watched&sort=watched_at&sort_dir=asc"
    )
    assert response.status_code == 200
    assert [item["title"] for item in response.json()["data"]] == [
        "Older Watch",
        "Newer Watch",
        "No Watch Date",
    ]


def test_date_watched_sort_second_page_continues_the_same_order(integration_client):
    with SessionLocal() as db:
        newer_id = _seed_watchlist_film(
            db,
            title="Newer Watch",
            year=2024,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        older_id = _seed_watchlist_film(
            db,
            title="Older Watch",
            year=2020,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        _seed_watchlist_film(
            db,
            title="No Watch Date",
            year=1999,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(newer_id),
            source=WatchSource.MANUAL,
            watched_at=date(2024, 6, 1),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(older_id),
            source=WatchSource.MANUAL,
            watched_at=date(2020, 1, 1),
        )
        db.commit()

    response = integration_client.get(
        "/api/v1/films?status=watched&sort=watched_at&sort_dir=desc&limit=1&offset=1"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["pagination"]["total"] == 3
    assert [item["title"] for item in payload["data"]] == ["Older Watch"]


def test_film_with_two_completed_watches_sorts_by_the_later_date(integration_client):
    with SessionLocal() as db:
        rewatch_id = _seed_watchlist_film(
            db,
            title="Rewatched Film",
            year=2019,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        single_id = _seed_watchlist_film(
            db,
            title="Single Watch",
            year=2024,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(rewatch_id),
            source=WatchSource.MANUAL,
            watched_at=date(2019, 1, 1),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(rewatch_id),
            source=WatchSource.MANUAL,
            watched_at=date(2025, 5, 1),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(single_id),
            source=WatchSource.MANUAL,
            watched_at=date(2024, 1, 1),
        )
        db.commit()

    response = integration_client.get(
        "/api/v1/films?status=watched&sort=watched_at&sort_dir=desc"
    )
    assert response.status_code == 200
    assert [item["title"] for item in response.json()["data"]] == [
        "Rewatched Film",
        "Single Watch",
    ]


def test_pending_draft_dated_today_sorts_with_todays_watches(integration_client):
    with SessionLocal() as db:
        draft_id = _seed_watchlist_film(
            db,
            title="Draft Today",
            year=2024,
            film_status=FilmStatus.PENDING_WATCH_REVIEW,
            on_watchlist=False,
        )
        older_id = _seed_watchlist_film(
            db,
            title="Completed Older",
            year=2020,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        _seed_watchlist_film(
            db,
            title="No Watch Date",
            year=1999,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        film_watch_repository.create_pending(
            db,
            film_id=uuid.UUID(draft_id),
            source=WatchSource.MANUAL,
            watched_at=date.today(),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(older_id),
            source=WatchSource.MANUAL,
            watched_at=date(2020, 1, 1),
        )
        db.commit()

    response = integration_client.get(
        "/api/v1/films?status=watched&sort=watched_at&sort_dir=desc"
    )
    assert response.status_code == 200
    assert [item["title"] for item in response.json()["data"]] == [
        "Draft Today",
        "Completed Older",
        "No Watch Date",
    ]


def test_pending_watch_sorts_by_the_newest_staged_date(integration_client):
    with SessionLocal() as db:
        staged_id = _seed_watchlist_film(
            db,
            title="Staged Later",
            year=2020,
            film_status=FilmStatus.PENDING_WATCH_REVIEW,
            on_watchlist=False,
        )
        completed_id = _seed_watchlist_film(
            db,
            title="Completed Mid",
            year=2024,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        film_watch_repository.create_pending(
            db,
            film_id=uuid.UUID(staged_id),
            source=WatchSource.LETTERBOXD_IMPORT,
            watched_at=date(2020, 1, 1),
            staged_watched_dates=["2026-02-25"],
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(completed_id),
            source=WatchSource.MANUAL,
            watched_at=date(2024, 6, 1),
        )
        db.commit()

    response = integration_client.get(
        "/api/v1/films?status=watched&sort=watched_at&sort_dir=desc"
    )
    assert response.status_code == 200
    assert [item["title"] for item in response.json()["data"]] == [
        "Staged Later",
        "Completed Mid",
    ]


def test_unknown_watched_date_sorts_with_dateless_films(integration_client):
    with SessionLocal() as db:
        unknown_id = _seed_watchlist_film(
            db,
            title="Unknown Date",
            year=1984,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        real_id = _seed_watchlist_film(
            db,
            title="Real Date",
            year=2020,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        _seed_watchlist_film(
            db,
            title="No Watch Date",
            year=1999,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(unknown_id),
            source=WatchSource.LETTERBOXD_IMPORT,
            watched_at=date(1984, 9, 28),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(real_id),
            source=WatchSource.MANUAL,
            watched_at=date(2020, 1, 1),
        )
        db.commit()

    for sort_dir in ("desc", "asc"):
        response = integration_client.get(
            f"/api/v1/films?status=watched&sort=watched_at&sort_dir={sort_dir}"
        )
        assert response.status_code == 200
        titles = [item["title"] for item in response.json()["data"]]
        assert titles == [
            "Real Date",
            "No Watch Date",
            "Unknown Date",
        ]
        unknown = next(item for item in response.json()["data"] if item["id"] == unknown_id)
        assert unknown["latest_watched_at"] == "1984-09-28"

    with SessionLocal() as db:
        stored = db.scalars(
            select(FilmWatch).where(FilmWatch.film_id == uuid.UUID(unknown_id))
        ).one()
        assert stored.watched_at == date(1984, 9, 28)
        assert stored.source == WatchSource.LETTERBOXD_IMPORT


def test_manual_and_rss_watches_on_28_september_1984_sort_as_that_day(
    integration_client,
):
    with SessionLocal() as db:
        manual_id = _seed_watchlist_film(
            db,
            title="Manual That Day",
            year=1984,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        rss_id = _seed_watchlist_film(
            db,
            title="Rss That Day",
            year=1984,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
            tmdb_id=910084,
        )
        later_id = _seed_watchlist_film(
            db,
            title="Later Watch",
            year=2020,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(manual_id),
            source=WatchSource.MANUAL,
            watched_at=date(1984, 9, 28),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(rss_id),
            source=WatchSource.RSS,
            watched_at=date(1984, 9, 28),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(later_id),
            source=WatchSource.MANUAL,
            watched_at=date(2020, 1, 1),
        )
        db.commit()

    oldest_first = integration_client.get(
        "/api/v1/films?status=watched&sort=watched_at&sort_dir=asc"
    )
    assert oldest_first.status_code == 200
    assert [item["title"] for item in oldest_first.json()["data"]] == [
        "Manual That Day",
        "Rss That Day",
        "Later Watch",
    ]


def test_unknown_watched_date_is_ignored_when_a_real_watch_exists(integration_client):
    with SessionLocal() as db:
        both_id = _seed_watchlist_film(
            db,
            title="Unknown And Real",
            year=2010,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        earlier_id = _seed_watchlist_film(
            db,
            title="Earlier Only",
            year=2001,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(both_id),
            source=WatchSource.LETTERBOXD_IMPORT,
            watched_at=date(1984, 9, 28),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(both_id),
            source=WatchSource.MANUAL,
            watched_at=date(2024, 3, 1),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(earlier_id),
            source=WatchSource.MANUAL,
            watched_at=date(2020, 1, 1),
        )
        db.commit()

    response = integration_client.get(
        "/api/v1/films?status=watched&sort=watched_at&sort_dir=desc"
    )
    assert response.status_code == 200
    assert [item["title"] for item in response.json()["data"]] == [
        "Unknown And Real",
        "Earlier Only",
    ]


def test_same_date_watched_orders_by_title(integration_client):
    with SessionLocal() as db:
        zed_id = _seed_watchlist_film(
            db,
            title="Zed",
            year=2024,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        amy_id = _seed_watchlist_film(
            db,
            title="Amy",
            year=2024,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        _seed_watchlist_film(
            db,
            title="Zed Missing",
            year=1990,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        _seed_watchlist_film(
            db,
            title="Amy Missing",
            year=1990,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        for film_id in (zed_id, amy_id):
            film_watch_repository.create_completed(
                db,
                film_id=uuid.UUID(film_id),
                source=WatchSource.MANUAL,
                watched_at=date(2024, 1, 1),
            )
        db.commit()

    for sort_dir in ("desc", "asc"):
        response = integration_client.get(
            f"/api/v1/films?status=watched&sort=watched_at&sort_dir={sort_dir}"
        )
        assert response.status_code == 200
        assert [item["title"] for item in response.json()["data"]] == [
            "Amy",
            "Zed",
            "Amy Missing",
            "Zed Missing",
        ]


def test_dateless_films_with_the_same_title_order_by_id(integration_client):
    with SessionLocal() as db:
        first_id = _seed_watchlist_film(
            db,
            title="Same Title",
            year=2001,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
            tmdb_id=910001,
        )
        second_id = _seed_watchlist_film(
            db,
            title="Same Title",
            year=2002,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
            tmdb_id=910002,
        )
    expected = sorted([first_id, second_id], key=lambda value: uuid.UUID(value))

    for sort_dir in ("desc", "asc"):
        response = integration_client.get(
            f"/api/v1/films?status=watched&sort=watched_at&sort_dir={sort_dir}"
        )
        assert response.status_code == 200
        assert [item["id"] for item in response.json()["data"]] == expected


def test_omitted_sort_stays_date_added_descending_for_watched_films(integration_client):
    with SessionLocal() as db:
        added_later_id = _seed_watchlist_film(
            db,
            title="Added Later",
            year=2024,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        added_earlier_id = _seed_watchlist_film(
            db,
            title="Added Earlier",
            year=2020,
            film_status=FilmStatus.WATCHED,
            on_watchlist=False,
        )
        db.get(Film, uuid.UUID(added_later_id)).created_at = datetime(
            2024, 6, 1, tzinfo=timezone.utc
        )
        db.get(Film, uuid.UUID(added_earlier_id)).created_at = datetime(
            2020, 1, 1, tzinfo=timezone.utc
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(added_later_id),
            source=WatchSource.MANUAL,
            watched_at=date(2020, 1, 1),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(added_earlier_id),
            source=WatchSource.MANUAL,
            watched_at=date(2024, 6, 1),
        )
        db.commit()

    response = integration_client.get("/api/v1/films?status=watched")
    assert response.status_code == 200
    assert [item["title"] for item in response.json()["data"]] == [
        "Added Later",
        "Added Earlier",
    ]


def test_watched_at_sort_is_allowed_on_the_watchlist(integration_client):
    with SessionLocal() as db:
        newer_id = _seed_watchlist_film(db, title="On List Newer", year=2024)
        older_id = _seed_watchlist_film(db, title="On List Older", year=2020)
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(newer_id),
            source=WatchSource.MANUAL,
            watched_at=date(2024, 8, 1),
        )
        film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(older_id),
            source=WatchSource.MANUAL,
            watched_at=date(2018, 2, 2),
        )
        db.commit()

    response = integration_client.get(
        "/api/v1/films?on_watchlist=true&sort=watched_at&sort_dir=desc"
    )
    assert response.status_code == 200
    assert [item["title"] for item in response.json()["data"]] == [
        "On List Newer",
        "On List Older",
    ]
