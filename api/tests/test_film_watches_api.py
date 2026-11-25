"""Watches API: star-tap create, partial edit, dateless watches, delete."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, text

from app.database.enums import FilmStatus, WatchSource
from app.database.models import FilmWatch
from app.database.session import get_engine, init_engine
from app.repositories import film_watch_repository, watchlist_repository
from tests.conftest import TEST_DATABASE_URL, requires_db
from tests.helpers.seed_ready_films import seed_ready_films

pytestmark = requires_db

SENTINEL = date(1984, 9, 28)


def _post_watch(client, film_id, **body):
    return client.post(f"/api/v1/films/{film_id}/watches", json=body)


def _alembic_config() -> Config:
    api_root = Path(__file__).resolve().parents[1]
    cfg = Config(str(api_root / "alembic.ini"))
    cfg.set_main_option("script_location", str(api_root / "alembic"))
    cfg.set_main_option("path_separator", "os")
    return cfg


def _dispose_app_engine() -> None:
    engine = get_engine()
    if engine is not None:
        engine.dispose()


def _column_nullable(engine, column: str) -> str:
    with engine.connect() as conn:
        return conn.execute(
            text(
                """
                SELECT is_nullable
                FROM information_schema.columns
                WHERE table_name = 'film_watches' AND column_name = :column
                """
            ),
            {"column": column},
        ).scalar_one()


def _stored_watched_at(engine, watch_id: uuid.UUID) -> date | None:
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT watched_at FROM film_watches WHERE id = :id"),
            {"id": watch_id},
        ).scalar_one_or_none()


def test_migration_nullable_watched_at_preserves_existing_rows(integration_env, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    dated = film_watch_repository.create_completed(
        db_session,
        film_id=film.id,
        source=WatchSource.MANUAL,
        watched_at=date(2020, 5, 5),
        score=3.5,
    )
    sentinel = film_watch_repository.create_completed(
        db_session,
        film_id=film.id,
        source=WatchSource.LETTERBOXD_IMPORT,
        watched_at=SENTINEL,
        score=None,
    )
    db_session.commit()
    dated_id = dated.id
    sentinel_id = sentinel.id
    film_id = film.id
    db_session.close()

    cfg = _alembic_config()
    raw = create_engine(TEST_DATABASE_URL)
    _dispose_app_engine()
    try:
        command.upgrade(cfg, "head")
        assert _column_nullable(raw, "watched_at") == "YES"
        assert _stored_watched_at(raw, dated_id) == date(2020, 5, 5)
        assert _stored_watched_at(raw, sentinel_id) == SENTINEL

        null_id = uuid.uuid4()
        with raw.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO film_watches (id, film_id, score, watched_at, source, is_pending)
                    VALUES (:id, :film_id, 4.0, NULL, 'manual', false)
                    """
                ),
                {"id": null_id, "film_id": film_id},
            )

        command.downgrade(cfg, "0008")
        assert _column_nullable(raw, "watched_at") == "NO"
        assert _stored_watched_at(raw, dated_id) == date(2020, 5, 5)
        assert _stored_watched_at(raw, sentinel_id) == SENTINEL
        assert _stored_watched_at(raw, null_id) is None

        command.upgrade(cfg, "head")
        assert _column_nullable(raw, "watched_at") == "YES"
        assert _stored_watched_at(raw, dated_id) == date(2020, 5, 5)
        assert _stored_watched_at(raw, sentinel_id) == SENTINEL
    finally:
        command.upgrade(cfg, "head")
        raw.dispose()
        init_engine(TEST_DATABASE_URL)


def test_post_watch_from_active_creates_dateless_finalized_watch(
    integration_client, db_session
):
    films = seed_ready_films(db_session, count=1)
    film = films[0]

    response = _post_watch(integration_client, film.id, score=4.0)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "watched"
    assert len(body["watches"]) == 1
    watch = body["watches"][0]
    assert watch["id"]
    assert watch["score"] == 4.0
    assert watch["watched_at"] is None
    assert watch["source"] == "manual"
    assert watch["is_pending"] is False

    db_session.expire_all()
    assert watchlist_repository.get_active_by_film_id(db_session, film.id) is None
    stored = db_session.get(FilmWatch, uuid.UUID(watch["id"]))
    assert stored is not None
    assert stored.watched_at is None
    assert stored.watched_at != SENTINEL


def test_post_watch_finalizes_pending_draft_without_a_second_row(
    integration_client, db_session
):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    pending_response = integration_client.post(
        f"/api/v1/films/{film.id}/status",
        json={"status": "pending_watch_review"},
    )
    assert pending_response.status_code == 200
    db_session.expire_all()
    pending = film_watch_repository.get_pending_for_film(db_session, film.id)
    assert pending is not None
    pending_id = str(pending.id)

    response = _post_watch(
        integration_client,
        film.id,
        score=3.5,
        watched_at=None,
        notes="Star tap",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "watched"
    assert len(body["watches"]) == 1
    assert body["watches"][0]["id"] == pending_id
    assert body["watches"][0]["watched_at"] is None
    assert body["watches"][0]["notes"] == "Star tap"
    assert body["watches"][0]["is_pending"] is False

    db_session.expire_all()
    stored = db_session.get(FilmWatch, uuid.UUID(pending_id))
    assert stored is not None
    assert stored.watched_at is None
    assert stored.watched_at != SENTINEL


def test_post_watch_does_not_expand_staged_dates_on_the_draft(
    integration_client, db_session
):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    pending_response = integration_client.post(
        f"/api/v1/films/{film.id}/status",
        json={"status": "pending_watch_review"},
    )
    assert pending_response.status_code == 200
    db_session.expire_all()
    pending = film_watch_repository.get_pending_for_film(db_session, film.id)
    assert pending is not None
    pending.staged_watched_dates = ["2024-06-01", "2024-07-01"]
    pending_id = str(pending.id)
    db_session.commit()

    response = _post_watch(integration_client, film.id, score=4.0)
    assert response.status_code == 200
    watches = response.json()["watches"]
    assert len(watches) == 1
    assert watches[0]["id"] == pending_id
    assert watches[0]["is_pending"] is False


def test_post_watch_on_watched_film_adds_another_watch(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    first = _post_watch(
        integration_client,
        film.id,
        score=4.0,
        watched_at="2024-01-01",
    )
    assert first.status_code == 200

    second = _post_watch(integration_client, film.id, score=5.0)
    assert second.status_code == 200
    watches = second.json()["watches"]
    assert second.json()["status"] == "watched"
    assert len(watches) == 2
    assert {watch["watched_at"] for watch in watches} == {"2024-01-01", None}
    assert {watch["score"] for watch in watches} == {4.0, 5.0}


def test_post_watch_on_archived_film_conflicts(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    archived = integration_client.post(
        f"/api/v1/films/{film.id}/status",
        json={"status": "archived"},
    )
    assert archived.status_code == 200

    response = _post_watch(integration_client, film.id, score=4.0)
    assert response.status_code == 409


def test_manual_watch_create_never_stores_unknown_date_sentinel(
    integration_client, db_session
):
    films = seed_ready_films(db_session, count=3)
    active, pending_film, watched_film = films

    integration_client.post(
        f"/api/v1/films/{pending_film.id}/status",
        json={"status": "pending_watch_review"},
    )
    assert _post_watch(integration_client, active.id, score=2.5).status_code == 200
    assert _post_watch(integration_client, pending_film.id, score=3.0).status_code == 200
    assert (
        _post_watch(integration_client, watched_film.id, score=4.5, watched_at="2024-03-03").status_code
        == 200
    )
    assert _post_watch(integration_client, watched_film.id, score=1.0).status_code == 200

    db_session.expire_all()
    manual = db_session.scalars(
        select(FilmWatch).where(FilmWatch.source == WatchSource.MANUAL)
    ).all()
    assert manual
    assert all(row.watched_at != SENTINEL for row in manual)


def test_post_watch_rejects_invalid_score_and_future_date(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    future = (date.today() + timedelta(days=1)).isoformat()

    bad_step = _post_watch(integration_client, film.id, score=3.3)
    assert bad_step.status_code == 422

    bad_date = _post_watch(integration_client, film.id, score=3.0, watched_at=future)
    assert bad_date.status_code == 422


def test_patch_watch_is_partial_and_null_clears_the_date(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    created = _post_watch(
        integration_client,
        film.id,
        score=4.0,
        watched_at="2020-01-01",
        notes="keep",
    )
    assert created.status_code == 200
    watch_id = created.json()["watches"][0]["id"]
    url = f"/api/v1/films/{film.id}/watches/{watch_id}"

    notes_only = integration_client.patch(url, json={"notes": "only notes"})
    assert notes_only.status_code == 200
    assert notes_only.json()["notes"] == "only notes"
    assert notes_only.json()["score"] == 4.0
    assert notes_only.json()["watched_at"] == "2020-01-01"

    date_only = integration_client.patch(url, json={"watched_at": "2021-02-02"})
    assert date_only.status_code == 200
    assert date_only.json()["watched_at"] == "2021-02-02"
    assert date_only.json()["score"] == 4.0
    assert date_only.json()["notes"] == "only notes"

    score_only = integration_client.patch(url, json={"score": 2.5})
    assert score_only.status_code == 200
    assert score_only.json()["score"] == 2.5
    assert score_only.json()["watched_at"] == "2021-02-02"
    assert score_only.json()["notes"] == "only notes"

    cleared = integration_client.patch(url, json={"watched_at": None})
    assert cleared.status_code == 200
    assert cleared.json()["watched_at"] is None
    assert cleared.json()["score"] == 2.5
    assert cleared.json()["notes"] == "only notes"

    future = (date.today() + timedelta(days=2)).isoformat()
    rejected = integration_client.patch(url, json={"watched_at": future})
    assert rejected.status_code == 422
    unchanged = integration_client.get(f"/api/v1/films/{film.id}")
    assert unchanged.json()["watches"][0]["watched_at"] is None


def test_delete_finalized_watch_keeps_film_watched(integration_client, db_session):
    films = seed_ready_films(db_session, count=2)
    film, other = films
    created = _post_watch(integration_client, film.id, score=4.0, watched_at="2019-04-04")
    watch_id = created.json()["watches"][0]["id"]

    deleted = integration_client.delete(f"/api/v1/films/{film.id}/watches/{watch_id}")
    assert deleted.status_code == 204
    assert deleted.content == b""

    detail = integration_client.get(f"/api/v1/films/{film.id}")
    assert detail.status_code == 200
    assert detail.json()["status"] == "watched"
    assert detail.json()["watches"] == []

    pending = integration_client.post(
        f"/api/v1/films/{other.id}/status",
        json={"status": "pending_watch_review"},
    )
    assert pending.status_code == 200
    db_session.expire_all()
    draft = film_watch_repository.get_pending_for_film(db_session, other.id)
    assert draft is not None
    pending_delete = integration_client.delete(f"/api/v1/films/{other.id}/watches/{draft.id}")
    assert pending_delete.status_code == 409

    wrong_film = integration_client.delete(f"/api/v1/films/{other.id}/watches/{watch_id}")
    assert wrong_film.status_code == 404
    missing_film = integration_client.delete(
        f"/api/v1/films/{uuid.uuid4()}/watches/{uuid.uuid4()}"
    )
    assert missing_film.status_code == 404


def test_null_watched_at_sorts_last_in_both_directions(integration_client, db_session):
    later, earlier, mixed, null_only, unknown, no_watch = seed_ready_films(
        db_session, count=6
    )
    titles = {
        later: "Alpha Real",
        earlier: "Beta Real",
        mixed: "Gamma Mixed",
        null_only: "Null Date",
        unknown: "Unknown Date",
        no_watch: "No Watch",
    }
    for film, title in titles.items():
        film.title = title
        film.status = FilmStatus.WATCHED

    film_watch_repository.create_completed(
        db_session,
        film_id=later.id,
        source=WatchSource.MANUAL,
        watched_at=date(2024, 6, 1),
        score=4.0,
    )
    film_watch_repository.create_completed(
        db_session,
        film_id=earlier.id,
        source=WatchSource.MANUAL,
        watched_at=date(2020, 1, 1),
        score=4.0,
    )
    film_watch_repository.create_completed(
        db_session,
        film_id=mixed.id,
        source=WatchSource.MANUAL,
        watched_at=date(2022, 2, 2),
        score=4.0,
    )
    film_watch_repository.create_completed(
        db_session,
        film_id=mixed.id,
        source=WatchSource.MANUAL,
        watched_at=None,
        score=3.0,
    )
    film_watch_repository.create_completed(
        db_session,
        film_id=null_only.id,
        source=WatchSource.MANUAL,
        watched_at=None,
        score=5.0,
    )
    film_watch_repository.create_completed(
        db_session,
        film_id=unknown.id,
        source=WatchSource.LETTERBOXD_IMPORT,
        watched_at=SENTINEL,
    )
    db_session.commit()

    newest = integration_client.get(
        "/api/v1/films?status=watched&sort=watched_at&sort_dir=desc&limit=50"
    )
    assert newest.status_code == 200
    newest_titles = [item["title"] for item in newest.json()["data"]]
    assert newest_titles == [
        "Alpha Real",
        "Gamma Mixed",
        "Beta Real",
        "No Watch",
        "Null Date",
        "Unknown Date",
    ]

    oldest = integration_client.get(
        "/api/v1/films?status=watched&sort=watched_at&sort_dir=asc&limit=50"
    )
    assert oldest.status_code == 200
    oldest_titles = [item["title"] for item in oldest.json()["data"]]
    assert oldest_titles == [
        "Beta Real",
        "Gamma Mixed",
        "Alpha Real",
        "No Watch",
        "Null Date",
        "Unknown Date",
    ]

    by_title = {item["title"]: item for item in newest.json()["data"]}
    assert by_title["Null Date"]["latest_watched_at"] is None
    assert by_title["No Watch"]["latest_watched_at"] is None
    assert by_title["Unknown Date"]["latest_watched_at"] == "1984-09-28"
    assert by_title["Gamma Mixed"]["latest_watched_at"] == "2022-02-02"


def test_create_watch_rejects_a_duplicate_date(integration_client, db_session):
    films = seed_ready_films(db_session, count=1)
    film = films[0]
    first = _post_watch(integration_client, film.id, score=4.0, watched_at="2024-01-01")
    assert first.status_code == 200
    second = _post_watch(integration_client, film.id, score=3.0, watched_at="2024-01-01")
    assert second.status_code == 409
