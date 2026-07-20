"""Integration tests for watched-library CSV import."""

from datetime import date
from pathlib import Path
from unittest.mock import MagicMock

from fastapi import BackgroundTasks

from app.database.enums import FilmStatus, WatchSource
from app.repositories import (
    film_repository,
    film_watch_repository,
    watchlist_repository,
)
from app.services.watched_import_service import WatchedImportService
from app.services.watch_review_service import WatchReviewService
from tests.conftest import requires_db
from tests.helpers.seed_ready_films import seed_ready_films

pytestmark = requires_db

FIXTURES = Path(__file__).parent / "fixtures" / "watched_import"


def _bytes(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def _service(providers=None) -> WatchedImportService:
    return WatchedImportService(providers or MagicMock())


def _import(db_session, service: WatchedImportService | None = None):
    svc = service or _service()
    return svc.import_watched(
        db_session,
        _bytes("watched.csv"),
        _bytes("ratings.csv"),
        _bytes("diary.csv"),
        BackgroundTasks(),
    )


def test_import_creates_completed_and_watched_status(db_session):
    result = _import(db_session)
    assert result.films_seen == 10
    assert result.films_created == 10
    assert result.pending_review == 1
    assert result.watches_created >= 9

    hellraiser = film_repository.get_by_letterboxd_uri(db_session, "https://boxd.it/1Zpi")
    assert hellraiser is not None
    assert hellraiser.status == FilmStatus.WATCHED
    watches = film_watch_repository.list_for_film(db_session, hellraiser.id)
    assert len(watches) == 1
    assert float(watches[0].score) == 5.0
    assert watches[0].watched_at == date(1984, 9, 28)
    assert watches[0].source == WatchSource.LETTERBOXD_IMPORT
    assert watchlist_repository.get_active_by_film_id(db_session, hellraiser.id) is None


def test_import_creates_pending_watch_review(db_session):
    _import(db_session)
    seven = film_repository.get_by_letterboxd_uri(db_session, "https://boxd.it/2axi")
    assert seven is not None
    assert seven.status == FilmStatus.PENDING_WATCH_REVIEW
    pending = film_watch_repository.get_pending_for_film(db_session, seven.id)
    assert pending is not None
    assert pending.score is None
    assert pending.watched_at == date(2023, 12, 31)
    assert pending.source == WatchSource.LETTERBOXD_IMPORT


def test_import_idempotent_reupload_skips_duplicates(db_session):
    first = _import(db_session)
    second = _import(db_session)
    assert second.films_created == 0
    assert second.watches_skipped_duplicate >= first.watches_created
    assert second.watches_created == 0


def test_import_active_to_watched_deactivates_watchlist(db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    film.title = "Hellraiser"
    film.year = 1987
    film.letterboxd_uri = "https://boxd.it/1Zpi"
    db_session.flush()

    assert watchlist_repository.get_active_by_film_id(db_session, film.id) is not None
    _import(db_session)

    db_session.expire_all()
    updated = film_repository.get_by_id(db_session, film.id)
    assert updated is not None
    assert updated.status == FilmStatus.WATCHED
    assert watchlist_repository.get_active_by_film_id(db_session, film.id) is None


def test_import_watched_never_demoted_to_pending(db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    film.title = "Seven Samurai"
    film.year = 1954
    film.letterboxd_uri = "https://boxd.it/2axi"
    film.status = FilmStatus.WATCHED
    entry = watchlist_repository.get_active_by_film_id(db_session, film.id)
    if entry is not None:
        watchlist_repository.deactivate_entry(db_session, entry)
    film_watch_repository.create_completed(
        db_session,
        film_id=film.id,
        source=WatchSource.MANUAL,
        watched_at=date(2020, 1, 1),
        score=4.0,
    )
    db_session.flush()

    _import(db_session)
    db_session.expire_all()
    updated = film_repository.get_by_id(db_session, film.id)
    assert updated is not None
    assert updated.status == FilmStatus.WATCHED
    watches = film_watch_repository.list_for_film(db_session, film.id)
    assert any(w.watched_at == date(2023, 12, 31) and w.score is None for w in watches)
    assert film_watch_repository.get_pending_for_film(db_session, film.id) is None


def test_import_archived_to_watched(db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    film.title = "Sid and Nancy"
    film.year = 1986
    film.letterboxd_uri = "https://boxd.it/1N6e"
    film_repository.archive_film(db_session, film)
    entry = watchlist_repository.get_active_by_film_id(db_session, film.id)
    if entry is not None:
        watchlist_repository.deactivate_entry(db_session, entry)
    db_session.flush()

    _import(db_session)
    db_session.expire_all()
    updated = film_repository.get_by_id(db_session, film.id)
    assert updated is not None
    assert updated.status == FilmStatus.WATCHED


def test_import_matches_existing_by_title_year_no_duplicate(db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    film.title = "Predator: Killer of Killers"
    film.year = 2025
    film.letterboxd_uri = "https://letterboxd.com/film/predator-killer-of-killers/"
    db_session.flush()

    result = _import(db_session)
    assert result.films_created == 9
    matched = film_repository.find_by_title_year(
        db_session, "Predator: Killer of Killers", 2025
    )
    assert matched is not None
    assert matched.id == film.id


def test_import_new_film_enqueues_enrichment_no_watchlist(db_session):
    result = _import(db_session)
    assert result.enrichment_job_id is not None
    assert result.films_created == 10
    for film in film_repository.list_films_for_job(db_session, result.enrichment_job_id):
        assert watchlist_repository.get_active_by_film_id(db_session, film.id) is None


def test_import_does_not_enforce_active_cap(db_session):
    seed_ready_films(db_session, count=5)
    result = _import(db_session)
    assert result.films_created == 10
    assert len(result.failures) == 0


def test_complete_review_materializes_staged_dates(db_session, integration_client):
    watched = (
        b"Date,Name,Year,Letterboxd URI\n"
        b"2024-01-01,Multi Diary,1999,https://boxd.it/multi1\n"
    )
    ratings = b"Date,Name,Year,Letterboxd URI,Rating\n"
    diary = (
        b"Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n"
        b"2024-01-02,Multi Diary,1999,https://boxd.it/log1,,,,2024-01-01\n"
        b"2024-02-02,Multi Diary,1999,https://boxd.it/log2,Yes,,,2024-02-01\n"
    )
    svc = _service(integration_client.app.state.provider_service)
    svc.import_watched(db_session, watched, ratings, diary, BackgroundTasks())

    film = film_repository.get_by_letterboxd_uri(db_session, "https://boxd.it/multi1")
    assert film is not None
    assert film.status == FilmStatus.PENDING_WATCH_REVIEW
    pending = film_watch_repository.get_pending_for_film(db_session, film.id)
    assert pending is not None
    assert pending.watched_at == date(2024, 1, 1)
    assert pending.staged_watched_dates == ["2024-02-01"]

    response = integration_client.post(
        f"/api/v1/films/{film.id}/watch-review",
        json={"score": 4.0, "watched_at": "2024-01-01"},
    )
    assert response.status_code == 200
    watches = response.json()["watches"]
    assert len(watches) == 2
    dates = {w["watched_at"] for w in watches}
    assert dates == {"2024-01-01", "2024-02-01"}
    assert all(w["score"] == 4.0 for w in watches)


def test_cancel_import_pending_without_watchlist_archives(db_session):
    watched = (
        b"Date,Name,Year,Letterboxd URI\n"
        b"2024-01-01,Cancel Me,2001,https://boxd.it/cancel1\n"
    )
    ratings = b"Date,Name,Year,Letterboxd URI,Rating\n"
    diary = (
        b"Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n"
        b"2024-01-02,Cancel Me,2001,https://boxd.it/clog,,,,2024-01-05\n"
    )
    _service().import_watched(db_session, watched, ratings, diary, BackgroundTasks())
    film = film_repository.get_by_letterboxd_uri(db_session, "https://boxd.it/cancel1")
    assert film is not None

    WatchReviewService.cancel_review(db_session, film.id)
    db_session.commit()
    db_session.expire_all()
    updated = film_repository.get_by_id(db_session, film.id)
    assert updated is not None
    assert updated.status == FilmStatus.ARCHIVED


def test_api_sync_watched_endpoint(integration_client):
    files = {
        "watched": ("watched.csv", _bytes("watched.csv"), "text/csv"),
        "ratings": ("ratings.csv", _bytes("ratings.csv"), "text/csv"),
        "diary": ("diary.csv", _bytes("diary.csv"), "text/csv"),
    }
    response = integration_client.post("/api/v1/sync/watched", files=files)
    assert response.status_code == 200
    body = response.json()
    assert body["films_seen"] == 10
    assert body["films_created"] == 10
    assert body["pending_review"] == 1
    assert body["watches_created"] >= 9
    assert body["enrichment_job_id"] is not None
