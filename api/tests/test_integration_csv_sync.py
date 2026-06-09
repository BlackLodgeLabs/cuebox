"""Integration tests for CSV synchronisation."""

import uuid

from sqlalchemy import text

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


def test_csv_sync_add_and_remove(integration_client, db_session):
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
    assert body["removed"] == 1
    assert body["unchanged"] == 1

    archived = integration_client.get("/api/v1/films?status=archived").json()["data"]
    assert any(f["letterboxd_uri"] == uri_remove for f in archived)


def test_csv_sync_watched_via_rss_event(integration_client, db_session):
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
    assert response.json()["watched"] == 1


def test_csv_sync_re_add_archived(integration_client, db_session):
    suffix = uuid.uuid4().hex[:8]
    uri = f"https://letterboxd.com/film/readd-{suffix}/"
    created = _import_csv(integration_client, _csv([("The Matrix", uri, 1999)]))
    _wait_for_complete(integration_client, created["job_id"])

    integration_client.post(
        "/api/v1/sync/csv",
        files={"file": ("watchlist.csv", _csv([]), "text/csv")},
    )

    with SessionLocal() as db:
        db.execute(
            text("UPDATE films SET status = 'archived' WHERE letterboxd_uri = :uri"),
            {"uri": uri},
        )
        db.commit()

    response = integration_client.post(
        "/api/v1/sync/csv",
        files={"file": ("watchlist.csv", _csv([("The Matrix", uri, 1999)]), "text/csv")},
    )
    assert response.status_code == 200
    assert response.json()["added"] == 1

    film = integration_client.get("/api/v1/films?status=active").json()["data"]
    assert any(f["letterboxd_uri"] == uri and f["enrichment_status"] == "ready" for f in film)


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
