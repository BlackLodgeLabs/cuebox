"""Unit tests for CSV sync diff logic."""

from unittest.mock import MagicMock

import pytest

from app.database.enums import EnrichmentStatus, FilmStatus
from app.services.csv_parser import ParsedWatchlistRow
from app.services.sync_service import SyncService


def _row(title: str, uri: str, year: int = 2000) -> ParsedWatchlistRow:
    return ParsedWatchlistRow(date="2024-01-01", title=title, year=year, letterboxd_uri=uri)


def _film(uri: str, *, status=FilmStatus.ACTIVE):
    film = MagicMock()
    film.letterboxd_uri = uri
    film.status = status
    film.enrichment_status = EnrichmentStatus.READY
    return film


def _entry(uri: str, film):
    entry = MagicMock()
    entry.letterboxd_uri = uri
    entry.film = film
    entry.active = True
    return entry


def test_csv_diff_added_removed_unchanged(monkeypatch):
    service = SyncService(MagicMock())
    db = MagicMock()

    existing_uri = "https://letterboxd.com/film/existing/"
    removed_uri = "https://letterboxd.com/film/removed/"
    added_uri = "https://letterboxd.com/film/added/"

    monkeypatch.setattr(
        "app.services.sync_service.watchlist_repository.list_active_entries",
        lambda _db: [
            _entry(existing_uri, _film(existing_uri)),
            _entry(removed_uri, _film(removed_uri)),
        ],
    )
    monkeypatch.setattr(
        "app.services.sync_service.watchlist_repository.count_active",
        lambda _db: 2,
    )
    monkeypatch.setattr(
        "app.services.sync_service.film_repository.get_by_letterboxd_uri",
        lambda _db, uri: None,
    )
    monkeypatch.setattr(
        "app.services.sync_service.rss_sync_repository.has_watched_event_for_uri",
        lambda _db, uri: False,
    )

    diff = service.csv_diff(
        db,
        [
            _row("Existing", existing_uri),
            _row("Added", added_uri),
        ],
    )

    assert diff.unchanged == 1
    assert len(diff.added) == 1
    assert diff.added[0].letterboxd_uri == added_uri
    assert len(diff.removed) == 1
    assert diff.removed[0].letterboxd_uri == removed_uri


def test_csv_diff_watched_when_rss_event_exists(monkeypatch):
    service = SyncService(MagicMock())
    db = MagicMock()
    watched_uri = "https://letterboxd.com/film/watched/"

    monkeypatch.setattr(
        "app.services.sync_service.watchlist_repository.list_active_entries",
        lambda _db: [_entry(watched_uri, _film(watched_uri))],
    )
    monkeypatch.setattr(
        "app.services.sync_service.watchlist_repository.count_active",
        lambda _db: 1,
    )
    monkeypatch.setattr(
        "app.services.sync_service.rss_sync_repository.has_watched_event_for_uri",
        lambda _db, uri: uri == watched_uri,
    )

    diff = service.csv_diff(db, [])
    assert len(diff.watched) == 1
    assert diff.watched[0].letterboxd_uri == watched_uri
    assert diff.removed == []


def test_csv_diff_re_add_archived(monkeypatch):
    service = SyncService(MagicMock())
    db = MagicMock()
    uri = "https://letterboxd.com/film/archived/"

    monkeypatch.setattr(
        "app.services.sync_service.watchlist_repository.list_active_entries",
        lambda _db: [],
    )
    monkeypatch.setattr(
        "app.services.sync_service.watchlist_repository.count_active",
        lambda _db: 0,
    )
    monkeypatch.setattr(
        "app.services.sync_service.film_repository.get_by_letterboxd_uri",
        lambda _db, _uri: _film(uri, status=FilmStatus.ARCHIVED),
    )
    monkeypatch.setattr(
        "app.services.sync_service.rss_sync_repository.has_watched_event_for_uri",
        lambda _db, _uri: False,
    )

    diff = service.csv_diff(db, [_row("Archived", uri)])
    assert len(diff.added) == 1


def test_csv_diff_watchlist_size_exceeded(monkeypatch):
    service = SyncService(MagicMock())
    db = MagicMock()

    monkeypatch.setattr(
        "app.services.sync_service.watchlist_repository.list_active_entries",
        lambda _db: [],
    )
    monkeypatch.setattr(
        "app.services.sync_service.watchlist_repository.count_active",
        lambda _db: 500,
    )
    monkeypatch.setattr(
        "app.services.sync_service.film_repository.get_by_letterboxd_uri",
        lambda _db, uri: None,
    )
    monkeypatch.setattr(
        "app.services.sync_service.rss_sync_repository.has_watched_event_for_uri",
        lambda _db, uri: False,
    )

    rows = [
        _row(f"Film {i}", f"https://letterboxd.com/film/new-{i}/")
        for i in range(1)
    ]
    with pytest.raises(Exception) as exc:
        service.csv_diff(db, rows)
    assert "500" in str(exc.value)
