"""Integration tests for POST /films/{id}/status transitions."""

import uuid

from app.repositories import film_repository, import_job_repository, watchlist_repository
from tests.conftest import requires_db
from tests.helpers.seed_ready_films import seed_ready_films

pytestmark = requires_db


def _set_status(client, film_id, status: str):
    return client.post(f"/api/v1/films/{film_id}/status", json={"status": status})


def test_active_to_watched(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    response = _set_status(integration_client, film.id, "watched")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "watched"
    assert watchlist_repository.get_active_by_film_id(db_session, film.id) is None


def test_active_to_archived(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    response = _set_status(integration_client, film.id, "archived")
    assert response.status_code == 200
    assert response.json()["status"] == "archived"


def test_watched_to_active_restore(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    entry = watchlist_repository.get_active_by_film_id(db_session, film.id)
    watchlist_repository.deactivate_entry(db_session, entry)
    film_repository.mark_watched(db_session, film)
    db_session.commit()

    response = _set_status(integration_client, film.id, "active")
    assert response.status_code == 200
    assert response.json()["status"] == "active"
    assert watchlist_repository.get_active_by_film_id(db_session, film.id) is not None


def test_archived_to_active_restore(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    entry = watchlist_repository.get_active_by_film_id(db_session, film.id)
    watchlist_repository.deactivate_entry(db_session, entry)
    film_repository.archive_film(db_session, film)
    db_session.commit()

    response = _set_status(integration_client, film.id, "active")
    assert response.status_code == 200
    assert response.json()["status"] == "active"


def test_forbidden_watched_to_archived(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    entry = watchlist_repository.get_active_by_film_id(db_session, film.id)
    watchlist_repository.deactivate_entry(db_session, entry)
    film_repository.mark_watched(db_session, film)
    db_session.commit()

    response = _set_status(integration_client, film.id, "archived")
    assert response.status_code == 409


def test_forbidden_archived_to_watched(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    entry = watchlist_repository.get_active_by_film_id(db_session, film.id)
    watchlist_repository.deactivate_entry(db_session, entry)
    film_repository.archive_film(db_session, film)
    db_session.commit()

    response = _set_status(integration_client, film.id, "watched")
    assert response.status_code == 409


def test_idempotent_same_status(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    first = _set_status(integration_client, film.id, "active")
    second = _set_status(integration_client, film.id, "active")
    assert first.status_code == 200
    assert second.status_code == 200


def test_invalid_status_returns_422(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    response = _set_status(integration_client, film.id, "invalid")
    assert response.status_code == 422


def test_restore_cap_returns_409(integration_client, db_session):
    job = import_job_repository.create(db_session, total_films=501)
    for index in range(500):
        uri = f"https://letterboxd.com/film/cap-restore-{index}/"
        seeded = film_repository.create(
            db_session,
            title=f"Cap Restore {index}",
            letterboxd_uri=uri,
            year=2000,
            import_job_id=job.id,
        )
        watchlist_repository.create_active_entry(
            db_session, film_id=seeded.id, letterboxd_uri=uri
        )

    archived_uri = "https://letterboxd.com/film/cap-restore-archived/"
    archived = film_repository.create(
        db_session,
        title="Cap Restore Archived",
        letterboxd_uri=archived_uri,
        year=2000,
        import_job_id=job.id,
    )
    film_repository.archive_film(db_session, archived)
    db_session.commit()

    response = _set_status(integration_client, archived.id, "active")
    assert response.status_code == 409
    assert "limit" in response.json()["error"]["message"].lower()


def test_watched_list_includes_removed_at(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    entry = watchlist_repository.get_active_by_film_id(db_session, film.id)
    watchlist_repository.deactivate_entry(db_session, entry)
    film_repository.mark_watched(db_session, film)
    db_session.commit()

    response = integration_client.get("/api/v1/films?status=watched")
    assert response.status_code == 200
    match = next(item for item in response.json()["data"] if item["id"] == str(film.id))
    assert match["removed_at"] is not None


def test_film_not_found(integration_client):
    missing = uuid.uuid4()
    response = _set_status(integration_client, missing, "watched")
    assert response.status_code == 404
