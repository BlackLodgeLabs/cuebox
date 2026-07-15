"""Integration tests for additive-only CSV synchronisation."""

import uuid

from sqlalchemy import text

from app.repositories import film_repository
from app.database.session import SessionLocal
from tests.conftest import requires_db
from tests.test_integration_import import _import_csv, _wait_for_complete

pytestmark = requires_db


def _csv(rows: list[tuple[str, str, int | None]]) -> bytes:
    lines = ["Date,Title,Year,Letterboxd URI"]
    for title, uri, year in rows:
        year_str = "" if year is None else str(year)
        lines.append(f"2024-01-01,{title},{year_str},{uri}")
    return "\n".join(lines).encode()


def test_csv_sync_additive_adds_new_uri(integration_client, db_session):
    suffix = uuid.uuid4().hex[:8]
    uri_keep = f"https://letterboxd.com/film/keep-{suffix}/"
    uri_remove = f"https://letterboxd.com/film/remove-{suffix}/"
    uri_add = f"https://letterboxd.com/film/add-{suffix}/"

    created = _import_csv(
        integration_client,
        _csv(
            [
                ("The Matrix", uri_keep, 1999),
                ("Dup Film A", uri_remove, 2000),
            ]
        ),
    )
    _wait_for_complete(integration_client, created["job_id"])

    response = integration_client.post(
        "/api/v1/sync/csv",
        files={
            "file": (
                "watchlist.csv",
                _csv([("The Matrix", uri_keep, 1999), ("Dup Film A", uri_add, 2000)]),
                "text/csv",
            )
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["added"] == 1
    assert body["unchanged"] == 1
    assert "removed" not in body
    assert "watched" not in body

    removed_film = integration_client.get("/api/v1/films?on_watchlist=true&limit=100").json()
    assert any(
        f["letterboxd_uri"] == uri_remove and f["status"] == "active"
        for f in removed_film["data"]
    )


def test_csv_sync_does_not_archive_on_absence(integration_client, db_session):
    suffix = uuid.uuid4().hex[:8]
    uri = f"https://letterboxd.com/film/absent-{suffix}/"
    created = _import_csv(integration_client, _csv([("The Matrix", uri, 1999)]))
    _wait_for_complete(integration_client, created["job_id"])

    response = integration_client.post(
        "/api/v1/sync/csv",
        files={"file": ("watchlist.csv", _csv([]), "text/csv")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["added"] == 0
    assert body["unchanged"] == 0

    film = next(
        item
        for item in integration_client.get("/api/v1/films?on_watchlist=true&limit=100").json()["data"]
        if item["letterboxd_uri"] == uri
    )
    assert film["status"] == "active"


def test_csv_sync_does_not_mark_watched_via_rss_on_absence(integration_client, db_session):
    suffix = uuid.uuid4().hex[:8]
    uri = f"https://letterboxd.com/film/watched-{suffix}/"
    created = _import_csv(integration_client, _csv([("The Matrix", uri, 1999)]))
    _wait_for_complete(integration_client, created["job_id"])

    with SessionLocal() as db:
        db.execute(
            text(
                """
                INSERT INTO rss_sync_events (
                    id, event_type, event_timestamp, letterboxd_uri, payload, processed
                ) VALUES (
                    gen_random_uuid(), 'watched', now(), :uri, '{}'::jsonb, true
                )
                """
            ),
            {"uri": uri},
        )
        db.commit()

    response = integration_client.post(
        "/api/v1/sync/csv",
        files={"file": ("watchlist.csv", _csv([]), "text/csv")},
    )
    assert response.status_code == 200
    assert "watched" not in response.json()

    film = next(
        item
        for item in integration_client.get("/api/v1/films?on_watchlist=true&limit=100").json()["data"]
        if item["letterboxd_uri"] == uri
    )
    assert film["status"] == "active"


def test_csv_sync_existing_archived_unchanged(integration_client, db_session):
    suffix = uuid.uuid4().hex[:8]
    uri = f"https://letterboxd.com/film/readd-{suffix}/"
    created = _import_csv(integration_client, _csv([("The Matrix", uri, 1999)]))
    _wait_for_complete(integration_client, created["job_id"])

    integration_client.post(
        "/api/v1/sync/csv",
        files={"file": ("watchlist.csv", _csv([]), "text/csv")},
    )

    film = film_repository.get_by_letterboxd_uri(db_session, uri)
    assert film is not None
    film_repository.archive_film(db_session, film)
    db_session.commit()

    response = integration_client.post(
        "/api/v1/sync/csv",
        files={"file": ("watchlist.csv", _csv([("The Matrix", uri, 1999)]), "text/csv")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["added"] == 0
    assert body["unchanged"] == 1

    film = integration_client.get("/api/v1/films?status=archived&limit=100").json()["data"]
    assert any(f["letterboxd_uri"] == uri for f in film)
    archived = next(f for f in film if f["letterboxd_uri"] == uri)
    assert archived["enrichment_status"] == "ready"


def test_csv_sync_watchlist_size_limit(integration_client):
    rows = [
        (f"Film {index}", f"https://letterboxd.com/film/overflow-{index}/", 2000)
        for index in range(501)
    ]
    response = integration_client.post(
        "/api/v1/sync/csv",
        files={"file": ("watchlist.csv", _csv(rows), "text/csv")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "WATCHLIST_SIZE_EXCEEDED"
