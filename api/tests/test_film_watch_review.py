"""Integration tests for watch review lifecycle."""

from datetime import date, timedelta

from app.database.enums import FilmStatus, WatchSource
from app.repositories import film_repository, film_watch_repository, watchlist_repository
from tests.conftest import requires_db
from tests.helpers.seed_ready_films import seed_ready_films

pytestmark = requires_db


def _set_status(client, film_id, status: str):
    return client.post(f"/api/v1/films/{film_id}/status", json={"status": status})


def _complete_review(client, film_id, *, score=4.0, watched_at=None, notes=None):
  body = {
      "score": score,
      "watched_at": (watched_at or date.today()).isoformat(),
  }
  if notes is not None:
      body["notes"] = notes
  return client.post(f"/api/v1/films/{film_id}/watch-review", json=body)


def test_active_to_pending_watch_review_deactivates_watchlist(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    response = _set_status(integration_client, film.id, "pending_watch_review")
    assert response.status_code == 200
    assert response.json()["status"] == "pending_watch_review"
    assert watchlist_repository.get_active_by_film_id(db_session, film.id) is None

    pending = film_watch_repository.get_pending_for_film(db_session, film.id)
    assert pending is not None
    assert pending.source == WatchSource.MANUAL


def test_complete_review_transitions_to_watched(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    _set_status(integration_client, film.id, "pending_watch_review")
    response = _complete_review(integration_client, film.id, notes="Great film")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "watched"
    assert len(body["watches"]) == 1
    assert body["watches"][0]["score"] == 4.0
    assert body["watches"][0]["notes"] == "Great film"
    assert body["watches"][0]["is_pending"] is False


def test_cancel_review_reverts_to_active(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    _set_status(integration_client, film.id, "pending_watch_review")
    response = integration_client.delete(f"/api/v1/films/{film.id}/watch-review")
    assert response.status_code == 204

    db_session.expire_all()
    restored = film_repository.get_by_id(db_session, film.id)
    assert restored is not None
    assert restored.status == FilmStatus.ACTIVE
    assert watchlist_repository.get_active_by_film_id(db_session, film.id) is not None
    assert film_watch_repository.get_pending_for_film(db_session, film.id) is None


def test_forbidden_pending_watch_review_to_archived(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    _set_status(integration_client, film.id, "pending_watch_review")
    response = _set_status(integration_client, film.id, "archived")
    assert response.status_code == 409


def test_forbidden_active_to_watched_direct(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    response = _set_status(integration_client, film.id, "watched")
    assert response.status_code == 409


def test_watched_to_active_retains_watch_records(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    _set_status(integration_client, film.id, "pending_watch_review")
    _complete_review(integration_client, film.id)
    response = _set_status(integration_client, film.id, "active")
    assert response.status_code == 200

    detail = integration_client.get(f"/api/v1/films/{film.id}")
    assert detail.status_code == 200
    assert len(detail.json()["watches"]) == 1


def test_score_validation_rejects_invalid_step(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    _set_status(integration_client, film.id, "pending_watch_review")
    response = _complete_review(integration_client, film.id, score=3.3)
    assert response.status_code == 422


def test_date_validation_rejects_future(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    _set_status(integration_client, film.id, "pending_watch_review")
    future = (date.today() + timedelta(days=1)).isoformat()
    response = integration_client.post(
        f"/api/v1/films/{film.id}/watch-review",
        json={"score": 3.5, "watched_at": future},
    )
    assert response.status_code == 422


def test_edit_watch_record(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    _set_status(integration_client, film.id, "pending_watch_review")
    _complete_review(integration_client, film.id, score=3.0)
    watch_id = integration_client.get(f"/api/v1/films/{film.id}").json()["watches"][0]["id"]

    response = integration_client.patch(
        f"/api/v1/films/{film.id}/watches/{watch_id}",
        json={"score": 4.5, "watched_at": date.today().isoformat(), "notes": "Updated"},
    )
    assert response.status_code == 200
    assert response.json()["score"] == 4.5
    assert response.json()["notes"] == "Updated"


def test_multiple_watch_records_on_one_film(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    _set_status(integration_client, film.id, "pending_watch_review")
    _complete_review(integration_client, film.id, score=3.5, watched_at=date(2024, 1, 1))

    film_watch_repository.create_pending(
        db_session,
        film_id=film.id,
        source=WatchSource.MANUAL,
        watched_at=date(2025, 6, 1),
        score=4.0,
    )
    film_watch_repository.finalize_pending(
        db_session,
        film_watch_repository.get_pending_for_film(db_session, film.id),
        score=4.0,
        watched_at=date(2025, 6, 1),
        notes="Rewatch",
    )
    db_session.commit()

    detail = integration_client.get(f"/api/v1/films/{film.id}")
    watches = detail.json()["watches"]
    assert len(watches) == 2


def test_watch_review_required_list(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    _set_status(integration_client, film.id, "pending_watch_review")

    response = integration_client.get("/api/v1/films/watch-review-required")
    assert response.status_code == 200
    data = response.json()["data"]
    assert any(item["film_id"] == str(film.id) for item in data)


def test_pending_review_count(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    _set_status(integration_client, film.id, "pending_watch_review")

    response = integration_client.get("/api/v1/films/reviews/pending-count")
    assert response.status_code == 200
    body = response.json()
    assert body["watch_review_count"] >= 1
    assert body["total"] >= body["watch_review_count"]
