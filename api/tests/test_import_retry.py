"""Failed-film re-import retry logic tests."""

import uuid
from unittest.mock import MagicMock

import pytest

from app.database.enums import EnrichmentStatus, FilmStatus
from app.database.models import Film
from app.services.import_service import ImportService

VALID_CSV = (
    "Date,Title,Year,Letterboxd URI\n"
    "2024-01-01,Retry Film,2000,https://letterboxd.com/film/retry-test/\n"
).encode()


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def import_service():
    return ImportService(MagicMock())


def test_failed_film_is_retried_not_counted_duplicate(monkeypatch, mock_db, import_service):
    existing_film = Film(
        id=uuid.uuid4(),
        title="Old Title",
        year=1999,
        letterboxd_uri="https://letterboxd.com/film/retry-test/",
        enrichment_status=EnrichmentStatus.FAILED,
        status=FilmStatus.ACTIVE,
    )
    job = MagicMock()
    job.id = uuid.uuid4()

    monkeypatch.setattr(
        "app.services.import_service.import_job_repository.create",
        lambda db: job,
    )
    monkeypatch.setattr(
        "app.services.import_service.film_repository.get_by_letterboxd_uri",
        lambda db, uri: existing_film,
    )
    reset_called = {"value": False}

    def _reset(db, film, **kwargs):
        reset_called["value"] = True
        film.enrichment_status = EnrichmentStatus.PENDING
        return film

    monkeypatch.setattr(
        "app.services.import_service.film_repository.reset_failed_for_retry",
        _reset,
    )
    monkeypatch.setattr(
        "app.services.import_service.watchlist_repository.ensure_active_entry",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        "app.services.import_service.film_repository.create",
        lambda *args, **kwargs: pytest.fail("should not create new film"),
    )

    counters = {}

    def _update_counters(db, job_obj, **kwargs):
        counters.update(kwargs)

    monkeypatch.setattr(
        "app.services.import_service.import_job_repository.update_counters",
        _update_counters,
    )
    background = MagicMock()
    import_service.create_import(mock_db, VALID_CSV, background)

    assert reset_called["value"] is True
    assert counters.get("total_films") == 1
    assert counters.get("duplicate_films") == 0
    background.add_task.assert_called_once()


def test_non_failed_duplicate_is_skipped(monkeypatch, mock_db, import_service):
    existing_film = Film(
        id=uuid.uuid4(),
        title="Ready Film",
        year=2000,
        letterboxd_uri="https://letterboxd.com/film/retry-test/",
        enrichment_status=EnrichmentStatus.ENRICHING,
        status=FilmStatus.ACTIVE,
    )
    job = MagicMock()
    job.id = uuid.uuid4()

    monkeypatch.setattr(
        "app.services.import_service.import_job_repository.create",
        lambda db: job,
    )
    monkeypatch.setattr(
        "app.services.import_service.film_repository.get_by_letterboxd_uri",
        lambda db, uri: existing_film,
    )
    counters = {}

    def _update_counters(db, job_obj, **kwargs):
        counters.update(kwargs)

    monkeypatch.setattr(
        "app.services.import_service.import_job_repository.update_counters",
        _update_counters,
    )
    import_service.create_import(mock_db, VALID_CSV, MagicMock())

    assert counters.get("total_films") == 0
    assert counters.get("duplicate_films") == 1
