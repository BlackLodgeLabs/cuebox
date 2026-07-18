"""Integration tests for manual watchlist add."""

import uuid
from unittest.mock import AsyncMock, patch

from app.database.enums import FilmStatus
from app.repositories import film_repository, import_job_repository, watchlist_repository
from tests.conftest import requires_db
from tests.integration_helpers import wait_for_film_status
from tests.mock_providers import MATRIX_TMDB_ID
from tests.test_integration_import import _single_film_csv

pytestmark = requires_db

MATRIX_LETTERBOXD_URI = "https://letterboxd.com/film/the-matrix/"


def _mock_resolve_success(tmdb_id: int):
    async def _resolve(_tmdb_id: int, **kwargs):
        if _tmdb_id == MATRIX_TMDB_ID:
            return MATRIX_LETTERBOXD_URI
        return None

    return _resolve


def _add_film(client, tmdb_id: int = MATRIX_TMDB_ID) -> dict:
    with patch(
        "app.services.watchlist_add_service.resolve_letterboxd_uri",
        new=AsyncMock(side_effect=_mock_resolve_success(tmdb_id)),
    ):
        response = client.post("/api/v1/watchlist/films", json={"tmdb_id": tmdb_id})
    assert response.status_code in (200, 202), response.text
    return response.json()


def test_global_tmdb_search(integration_client):
    response = integration_client.get(
        "/api/v1/films/tmdb-search",
        params={"q": "The Matrix"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data"][0]["tmdb_id"] == MATRIX_TMDB_ID


def test_add_film_happy_path_enriches_to_ready(integration_client):
    body = _add_film(integration_client)
    assert body["enrichment_status"] == "enriching"
    film = wait_for_film_status(integration_client, body["film_id"], "ready")
    assert film["metadata"]["metadata_source"] == "tmdb_manual_add"
    assert film["metadata"]["match_confidence"] == 1.0
    assert film["metadata"]["tmdb_id"] == MATRIX_TMDB_ID

    reviews = integration_client.get("/api/v1/films/review-required").json()["data"]
    assert all(item["film_id"] != body["film_id"] for item in reviews)


def test_add_film_redirect_failure_creates_letterboxd_review(integration_client):
    with patch(
        "app.services.letterboxd_resolver._resolve_via_tmdb_redirect",
        new=AsyncMock(return_value=None),
    ), patch(
        "app.services.letterboxd_resolver._resolve_via_slug_probe",
        new=AsyncMock(return_value=None),
    ):
        response = integration_client.post(
            "/api/v1/watchlist/films",
            json={"tmdb_id": MATRIX_TMDB_ID},
        )
    assert response.status_code == 202
    body = response.json()
    assert body["enrichment_status"] == "review_required"
    assert body["review_id"]

    reviews = integration_client.get("/api/v1/films/review-required").json()["data"]
    match = next(item for item in reviews if item["review_id"] == body["review_id"])
    assert match["review_type"] == "letterboxd_uri"


def test_resolve_letterboxd_review_completes_add(integration_client):
    with patch(
        "app.services.letterboxd_resolver._resolve_via_tmdb_redirect",
        new=AsyncMock(return_value=None),
    ), patch(
        "app.services.letterboxd_resolver._resolve_via_slug_probe",
        new=AsyncMock(return_value=None),
    ):
        add = integration_client.post(
            "/api/v1/watchlist/films",
            json={"tmdb_id": MATRIX_TMDB_ID},
        ).json()

    suffix = uuid.uuid4().hex[:8]
    pasted_uri = f"https://letterboxd.com/film/manual-resolve-{suffix}/"
    resolve = integration_client.post(
        f"/api/v1/reviews/{add['review_id']}/resolve-letterboxd",
        json={"letterboxd_uri": pasted_uri},
    )
    assert resolve.status_code == 200

    film = wait_for_film_status(integration_client, add["film_id"], "ready")
    assert film["letterboxd_uri"] == pasted_uri
    assert film["metadata"]["tmdb_id"] == MATRIX_TMDB_ID


def test_add_film_already_on_watchlist(integration_client):
    first = _add_film(integration_client)
    wait_for_film_status(integration_client, first["film_id"], "ready")

    with patch(
        "app.services.watchlist_add_service.resolve_letterboxd_uri",
        new=AsyncMock(return_value=MATRIX_LETTERBOXD_URI),
    ):
        second = integration_client.post(
            "/api/v1/watchlist/films",
            json={"tmdb_id": MATRIX_TMDB_ID},
        )
    assert second.status_code == 200
    body = second.json()
    assert body["already_on_watchlist"] is True
    assert body["film_id"] == first["film_id"]


def test_add_film_restores_archived(integration_client, db_session):
    body = _add_film(integration_client)
    film_id = uuid.UUID(body["film_id"])
    film = film_repository.get_by_id(db_session, film_id)
    assert film is not None
    entry = watchlist_repository.get_active_by_film_id(db_session, film_id)
    assert entry is not None
    watchlist_repository.deactivate_entry(db_session, entry)
    film_repository.archive_film(db_session, film)
    db_session.commit()

    with patch(
        "app.services.watchlist_add_service.resolve_letterboxd_uri",
        new=AsyncMock(return_value=MATRIX_LETTERBOXD_URI),
    ):
        restored = integration_client.post(
            "/api/v1/watchlist/films",
            json={"tmdb_id": MATRIX_TMDB_ID},
        )
    assert restored.status_code == 202
    payload = restored.json()
    assert payload["restored"] is True
    assert payload["film_id"] == str(film_id)

    refreshed = film_repository.get_by_id(db_session, film_id)
    assert refreshed is not None
    assert refreshed.status == FilmStatus.ACTIVE
    assert watchlist_repository.get_active_by_film_id(db_session, film_id) is not None


def test_add_film_restores_watched(integration_client, db_session):
    body = _add_film(integration_client)
    wait_for_film_status(integration_client, body["film_id"], "ready")
    film_id = uuid.UUID(body["film_id"])
    film = film_repository.get_by_id(db_session, film_id)
    assert film is not None
    entry = watchlist_repository.get_active_by_film_id(db_session, film_id)
    watchlist_repository.deactivate_entry(db_session, entry)
    film_repository.mark_watched(db_session, film)
    db_session.commit()

    with patch(
        "app.services.watchlist_add_service.resolve_letterboxd_uri",
        new=AsyncMock(return_value=MATRIX_LETTERBOXD_URI),
    ):
        restored = integration_client.post(
            "/api/v1/watchlist/films",
            json={"tmdb_id": MATRIX_TMDB_ID},
        )
    assert restored.status_code == 202
    assert restored.json()["restored"] is True

    refreshed = film_repository.get_by_id(db_session, film_id)
    assert refreshed is not None
    assert refreshed.status == FilmStatus.ACTIVE


def test_manual_add_exempt_from_cap(integration_client, db_session):
    job = import_job_repository.create(db_session, total_films=501)
    for i in range(501):
        uri = f"https://letterboxd.com/film/cap-seed-{i}/"
        film = film_repository.create(
            db_session,
            title=f"Cap Seed {i}",
            letterboxd_uri=uri,
            year=2000,
            import_job_id=job.id,
        )
        watchlist_repository.create_active_entry(
            db_session, film_id=film.id, letterboxd_uri=uri
        )
    db_session.commit()

    new_tmdb_id = 603
    new_uri = "https://letterboxd.com/film/cap-manual-add/"
    with patch(
        "app.services.watchlist_add_service.resolve_letterboxd_uri",
        new=AsyncMock(return_value=new_uri),
    ):
        response = integration_client.post(
            "/api/v1/watchlist/films",
            json={"tmdb_id": new_tmdb_id},
        )
    assert response.status_code == 202


def test_csv_sync_preserves_manual_add(integration_client, db_session):
    body = _add_film(integration_client)
    wait_for_film_status(integration_client, body["film_id"], "ready")

    csv_without_manual = _single_film_csv()
    sync = integration_client.post(
        "/api/v1/sync/csv",
        files={"file": ("watchlist.csv", csv_without_manual, "text/csv")},
    )
    assert sync.status_code == 200

    film = integration_client.get(f"/api/v1/films/{body['film_id']}").json()
    assert film["status"] == "active"


def test_rss_watched_applies_to_manual_add(integration_client, db_session):
    body = _add_film(integration_client)
    wait_for_film_status(integration_client, body["film_id"], "ready")
    film_id = uuid.UUID(body["film_id"])

    from app.services.sync_service import SyncService

    service = SyncService(integration_client.app.state.provider_service)
    service._apply_watched(
        db_session,
        MATRIX_LETTERBOXD_URI,
        {"title": "The Matrix", "year": 1999},
    )
    db_session.commit()

    film = film_repository.get_by_id(db_session, film_id)
    assert film is not None
    assert film.status == FilmStatus.PENDING_WATCH_REVIEW
    assert watchlist_repository.get_active_by_film_id(db_session, film_id) is None


def test_restore_pending_watch_review_clears_pending_record(integration_client, db_session):
    from app.repositories import film_watch_repository

    body = _add_film(integration_client)
    wait_for_film_status(integration_client, body["film_id"], "ready")
    film_id = uuid.UUID(body["film_id"])

    integration_client.post(
        f"/api/v1/films/{film_id}/status",
        json={"status": "pending_watch_review"},
    )
    assert film_watch_repository.get_pending_for_film(db_session, film_id) is not None

    with patch(
        "app.services.watchlist_add_service.resolve_letterboxd_uri",
        new=AsyncMock(side_effect=_mock_resolve_success(MATRIX_TMDB_ID)),
    ):
        response = integration_client.post(
            "/api/v1/watchlist/films",
            json={"tmdb_id": MATRIX_TMDB_ID},
        )
    assert response.status_code in (200, 202), response.text

    db_session.expire_all()
    film = film_repository.get_by_id(db_session, film_id)
    assert film is not None
    assert film.status == FilmStatus.ACTIVE
    assert film_watch_repository.get_pending_for_film(db_session, film_id) is None
    assert watchlist_repository.get_active_by_film_id(db_session, film_id) is not None


def test_add_film_resolves_via_slug_when_redirect_blocked(integration_client):
    with patch(
        "app.services.letterboxd_resolver._resolve_via_tmdb_redirect",
        new=AsyncMock(return_value=None),
    ):
        response = integration_client.post(
            "/api/v1/watchlist/films",
            json={"tmdb_id": MATRIX_TMDB_ID},
        )
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["enrichment_status"] == "enriching"
    film = wait_for_film_status(integration_client, body["film_id"], "ready")
    assert film["letterboxd_uri"] == MATRIX_LETTERBOXD_URI


def test_add_film_invalid_tmdb_id(integration_client):
    response = integration_client.post(
        "/api/v1/watchlist/films",
        json={"tmdb_id": 99999999},
    )
    assert response.status_code == 404


def test_add_film_pending_review_is_idempotent(integration_client):
    with patch(
        "app.services.watchlist_add_service.resolve_letterboxd_uri",
        new=AsyncMock(return_value=None),
    ):
        first = integration_client.post(
            "/api/v1/watchlist/films",
            json={"tmdb_id": MATRIX_TMDB_ID},
        )
        second = integration_client.post(
            "/api/v1/watchlist/films",
            json={"tmdb_id": MATRIX_TMDB_ID},
        )
    assert first.status_code == 202
    assert second.status_code == 202
    first_body = first.json()
    second_body = second.json()
    assert first_body["review_id"] == second_body["review_id"]
    assert first_body["film_id"] == second_body["film_id"]
