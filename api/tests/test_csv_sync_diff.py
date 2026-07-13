"""Unit tests for additive-only CSV sync diff logic."""

from unittest.mock import MagicMock

import pytest

from app.services.csv_parser import ParsedWatchlistRow
from app.services.sync_service import SyncService


def _row(title: str, uri: str, year: int = 2000) -> ParsedWatchlistRow:
    return ParsedWatchlistRow(date="2024-01-01", title=title, year=year, letterboxd_uri=uri)


def _film(uri: str, *, status=None):
    from app.database.enums import EnrichmentStatus, FilmStatus

    film = MagicMock()
    film.letterboxd_uri = uri
    film.status = status or FilmStatus.ACTIVE
    film.enrichment_status = EnrichmentStatus.READY
    return film


def test_csv_diff_adds_new_uri_only(monkeypatch):
    service = SyncService(MagicMock())
    db = MagicMock()

    existing_uri = "https://letterboxd.com/film/existing/"
    added_uri = "https://letterboxd.com/film/added/"

    def _get_by_uri(_db, uri):
        if uri == existing_uri:
            return _film(existing_uri)
        return None

    monkeypatch.setattr(
        "app.services.sync_service.film_repository.get_by_letterboxd_uri",
        _get_by_uri,
    )
    monkeypatch.setattr(
        "app.services.sync_service.watchlist_repository.count_active",
        lambda _db: 1,
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


def test_csv_diff_existing_watched_or_archived_is_unchanged(monkeypatch):
    service = SyncService(MagicMock())
    db = MagicMock()
    from app.database.enums import FilmStatus

    watched_uri = "https://letterboxd.com/film/watched/"
    archived_uri = "https://letterboxd.com/film/archived/"

    def _get_by_uri(_db, uri):
        if uri == watched_uri:
            return _film(watched_uri, status=FilmStatus.WATCHED)
        if uri == archived_uri:
            return _film(archived_uri, status=FilmStatus.ARCHIVED)
        return None

    monkeypatch.setattr(
        "app.services.sync_service.film_repository.get_by_letterboxd_uri",
        _get_by_uri,
    )
    monkeypatch.setattr(
        "app.services.sync_service.watchlist_repository.count_active",
        lambda _db: 0,
    )

    diff = service.csv_diff(
        db,
        [
            _row("Watched", watched_uri),
            _row("Archived", archived_uri),
        ],
    )

    assert diff.unchanged == 2
    assert diff.added == []


def test_csv_diff_does_not_remove_films_missing_from_csv(monkeypatch):
    service = SyncService(MagicMock())
    db = MagicMock()

    monkeypatch.setattr(
        "app.services.sync_service.film_repository.get_by_letterboxd_uri",
        lambda _db, uri: None,
    )
    monkeypatch.setattr(
        "app.services.sync_service.watchlist_repository.count_active",
        lambda _db: 1,
    )

    diff = service.csv_diff(db, [])
    assert diff.added == []
    assert diff.unchanged == 0


def test_csv_diff_watchlist_size_exceeded(monkeypatch):
    service = SyncService(MagicMock())
    db = MagicMock()

    monkeypatch.setattr(
        "app.services.sync_service.watchlist_repository.count_active",
        lambda _db: 500,
    )
    monkeypatch.setattr(
        "app.services.sync_service.film_repository.get_by_letterboxd_uri",
        lambda _db, uri: None,
    )

    rows = [
        _row(f"Film {i}", f"https://letterboxd.com/film/new-{i}/")
        for i in range(1)
    ]
    with pytest.raises(Exception) as exc:
        service.csv_diff(db, rows)
    assert "500" in str(exc.value)
