"""Null score persistence and API serialization for film_watches."""

from datetime import date

from app.database.enums import FilmStatus, WatchSource
from app.repositories import film_watch_repository, watchlist_repository
from tests.conftest import requires_db
from tests.helpers.seed_ready_films import seed_ready_films

pytestmark = requires_db


def test_null_score_persists_and_serializes_as_json_null(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    entry = watchlist_repository.get_active_by_film_id(db_session, film.id)
    if entry is not None:
        watchlist_repository.deactivate_entry(db_session, entry)
    film.status = FilmStatus.WATCHED
    watch = film_watch_repository.create_completed(
        db_session,
        film_id=film.id,
        source=WatchSource.LETTERBOXD_IMPORT,
        watched_at=date(1984, 9, 28),
        score=None,
    )
    db_session.commit()

    detail = integration_client.get(f"/api/v1/films/{film.id}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["status"] == "watched"
    assert len(body["watches"]) == 1
    assert body["watches"][0]["id"] == str(watch.id)
    assert body["watches"][0]["score"] is None
    assert body["watches"][0]["watched_at"] == "1984-09-28"
    assert body["watches"][0]["source"] == "letterboxd_import"


def test_pending_null_score_no_longer_coerced_to_half_star(db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    pending = film_watch_repository.create_pending(
        db_session,
        film_id=film.id,
        source=WatchSource.LETTERBOXD_IMPORT,
        watched_at=date(2024, 1, 1),
        score=None,
    )
    db_session.flush()
    assert pending.score is None
