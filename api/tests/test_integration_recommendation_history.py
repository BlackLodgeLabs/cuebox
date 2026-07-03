"""Integration tests for recommendation history endpoints."""

import time
import uuid

from sqlalchemy import select

from app.database.models import (
    RecommendationCandidate,
    RecommendationExposure,
    RecommendationResult,
    RecommendationSession,
)
from app.repositories import recommendation_exposure_repository
from tests.conftest import requires_db
from tests.helpers.seed_ready_films import DEFAULT_QUESTIONNAIRE, seed_ready_films

pytestmark = requires_db


def _create_session(integration_client, db_session):
    seed_ready_films(db_session, count=5)
    response = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _candidate_film_ids(db_session, session_id: uuid.UUID) -> list[uuid.UUID]:
    stmt = select(RecommendationCandidate.film_id).where(
        RecommendationCandidate.session_id == session_id
    )
    return list(db_session.scalars(stmt).all())


def test_history_list_and_detail(integration_client, db_session):
    seed_ready_films(db_session, count=5)
    created = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE},
    ).json()
    session_id = created["session_id"]

    started = time.monotonic()
    history = integration_client.get("/api/v1/recommendations?limit=10").json()
    elapsed = time.monotonic() - started
    assert elapsed < 2.0, f"GET /recommendations took {elapsed:.2f}s (target < 2s)"
    assert history["pagination"]["total"] >= 1
    assert any(item["session_id"] == session_id for item in history["data"])

    detail = integration_client.get(f"/api/v1/recommendations/{session_id}").json()
    assert detail["profile_summary"] is not None
    assert detail["profile_summary"]["structured_profile"]
    assert detail["winner"]["title"]
    assert detail["winner"]["explanation"]["most_influential_factors"]
    assert detail["winner"]["explanation"]["why_it_beat_alternatives"]
    assert detail["winner"]["synopsis"]
    assert detail["winner"]["tmdb_rating"] is not None


def test_insufficient_candidates(integration_client, db_session):
    response = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INSUFFICIENT_CANDIDATES"


def test_delete_recommendation_session_happy_path(integration_client, db_session):
    created = _create_session(integration_client, db_session)
    session_id = created["session_id"]

    response = integration_client.delete(f"/api/v1/recommendations/{session_id}")
    assert response.status_code == 204
    assert response.content == b""


def test_delete_recommendation_session_not_found(integration_client, db_session):
    missing_id = uuid.uuid4()
    response = integration_client.delete(f"/api/v1/recommendations/{missing_id}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"

    created = _create_session(integration_client, db_session)
    session_id = created["session_id"]
    first = integration_client.delete(f"/api/v1/recommendations/{session_id}")
    assert first.status_code == 204
    second = integration_client.delete(f"/api/v1/recommendations/{session_id}")
    assert second.status_code == 404


def test_delete_cascades_candidates_and_results(integration_client, db_session):
    created = _create_session(integration_client, db_session)
    session_id = uuid.UUID(created["session_id"])

    assert db_session.get(RecommendationSession, session_id) is not None
    candidates = db_session.scalars(
        select(RecommendationCandidate).where(
            RecommendationCandidate.session_id == session_id
        )
    ).all()
    assert len(candidates) > 0
    assert db_session.get(RecommendationResult, session_id) is not None

    response = integration_client.delete(f"/api/v1/recommendations/{session_id}")
    assert response.status_code == 204

    assert db_session.get(RecommendationSession, session_id) is None
    remaining_candidates = db_session.scalars(
        select(RecommendationCandidate).where(
            RecommendationCandidate.session_id == session_id
        )
    ).all()
    assert remaining_candidates == []
    assert db_session.get(RecommendationResult, session_id) is None


def test_delete_reverses_exposure_counts(integration_client, db_session):
    created = _create_session(integration_client, db_session)
    session_id = uuid.UUID(created["session_id"])
    winner_film_id = uuid.UUID(created["winner"]["film_id"])
    candidate_ids = _candidate_film_ids(db_session, session_id)

    exposures_before = {
        film_id: db_session.get(RecommendationExposure, film_id)
        for film_id in candidate_ids
    }
    assert all(row is not None for row in exposures_before.values())
    assert exposures_before[winner_film_id].winner_count >= 1

    response = integration_client.delete(f"/api/v1/recommendations/{session_id}")
    assert response.status_code == 204

    for film_id in candidate_ids:
        row = db_session.get(RecommendationExposure, film_id)
        assert row is None


def test_delete_recomputes_last_recommended_at(integration_client, db_session):
    seed_ready_films(db_session, count=5)
    first = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE},
    ).json()
    second = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE},
    ).json()

    first_session_id = uuid.UUID(first["session_id"])
    second_session_id = uuid.UUID(second["session_id"])
    shared_film_ids = set(_candidate_film_ids(db_session, first_session_id)) & set(
        _candidate_film_ids(db_session, second_session_id)
    )
    assert shared_film_ids, "Expected overlapping candidates across sessions"

    first_session = db_session.get(RecommendationSession, first_session_id)
    film_id = next(iter(shared_film_ids))
    exposure_before = db_session.get(RecommendationExposure, film_id)
    assert exposure_before is not None
    assert exposure_before.last_recommended_at is not None

    response = integration_client.delete(f"/api/v1/recommendations/{second_session_id}")
    assert response.status_code == 204

    exposure_after = db_session.get(RecommendationExposure, film_id)
    assert exposure_after is not None
    assert exposure_after.last_recommended_at == first_session.created_at


def test_delete_excludes_from_history_list(integration_client, db_session):
    created = _create_session(integration_client, db_session)
    session_id = created["session_id"]

    before = integration_client.get("/api/v1/recommendations?limit=10").json()
    total_before = before["pagination"]["total"]
    assert any(item["session_id"] == session_id for item in before["data"])

    response = integration_client.delete(f"/api/v1/recommendations/{session_id}")
    assert response.status_code == 204

    after = integration_client.get("/api/v1/recommendations?limit=10").json()
    assert after["pagination"]["total"] == total_before - 1
    assert not any(item["session_id"] == session_id for item in after["data"])

    detail = integration_client.get(f"/api/v1/recommendations/{session_id}")
    assert detail.status_code == 404


def test_delete_dev_routes_return_404(integration_client, db_session, dev_mode_client):
    created = _create_session(integration_client, db_session)
    session_id = created["session_id"]

    response = integration_client.delete(f"/api/v1/recommendations/{session_id}")
    assert response.status_code == 204

    for suffix in ("retrieval", "scoring", "ai"):
        path = f"/api/v1/dev/recommendations/{session_id}/{suffix}"
        dev_response = dev_mode_client.get(path)
        assert dev_response.status_code == 404, path


def test_delete_diversity_scoring_parity(integration_client, db_session):
    films = seed_ready_films(db_session, count=5)
    film_ids = [film.id for film in films]

    baseline_map = recommendation_exposure_repository.get_map(db_session, film_ids)
    assert baseline_map == {}

    created = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE},
    ).json()
    session_id = created["session_id"]
    candidate_ids = _candidate_film_ids(db_session, uuid.UUID(session_id))

    after_create = recommendation_exposure_repository.get_map(
        db_session, candidate_ids
    )
    assert len(after_create) > 0

    response = integration_client.delete(f"/api/v1/recommendations/{session_id}")
    assert response.status_code == 204

    after_delete = recommendation_exposure_repository.get_map(
        db_session, candidate_ids
    )
    assert after_delete == {}
