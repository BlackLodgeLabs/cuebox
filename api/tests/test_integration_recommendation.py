"""Integration tests for recommendation pipeline."""

import os
import time

import pytest
from sqlalchemy import text

from app.database.session import SessionLocal
from tests.conftest import requires_db
from tests.helpers.seed_ready_films import DEFAULT_QUESTIONNAIRE, seed_ready_films

pytestmark = requires_db

slow = pytest.mark.slow


def test_end_to_end_recommendation(integration_client, db_session):
    seed_ready_films(db_session, count=5)
    started = time.monotonic()
    response = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE, "notes": "Slow burn horror"},
    )
    elapsed = time.monotonic() - started

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["winner"]["film_id"]
    assert body["winner"]["explanation"]["why_it_matches"]
    assert body["winner"]["explanation"]["most_influential_factors"]
    assert body["winner"]["explanation"]["why_it_beat_alternatives"]
    assert body["winner"]["synopsis"]
    assert body["winner"]["tmdb_rating"] == 7.5
    assert len(body["runners_up"]) <= 4
    assert elapsed < 30

    detail = integration_client.get(
        f"/api/v1/recommendations/{body['session_id']}"
    ).json()
    assert detail["winner"]["explanation"]["most_influential_factors"]
    assert detail["winner"]["explanation"]["why_it_beat_alternatives"]
    assert detail["winner"]["synopsis"] == body["winner"]["synopsis"]
    assert detail["winner"]["tmdb_rating"] == body["winner"]["tmdb_rating"]

    with SessionLocal() as db:
        candidate_rows = db.execute(
            text(
                "SELECT retrieval_rank, similarity_score, raw_score, final_score, score_breakdown "
                "FROM recommendation_candidates WHERE session_id = :sid"
            ),
            {"sid": body["session_id"]},
        ).all()
    assert candidate_rows
    assert all(row.retrieval_rank is not None for row in candidate_rows)
    assert all(row.similarity_score is not None for row in candidate_rows)


@slow
@pytest.mark.skipif(
    os.environ.get("RUN_SLOW_PERF") != "1",
    reason="Set RUN_SLOW_PERF=1 to run large-watchlist performance benchmark",
)
def test_recommendation_large_watchlist_under_30_seconds(integration_client, db_session):
    """Optional benchmark: 100 ready films with mocked providers (RUN_SLOW_PERF=1)."""
    seed_ready_films(db_session, count=100)
    started = time.monotonic()
    response = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE},
    )
    elapsed = time.monotonic() - started
    assert response.status_code == 200, response.text
    assert elapsed < 30, f"Recommendation took {elapsed:.2f}s on 100-film watchlist"
