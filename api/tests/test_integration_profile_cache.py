"""Integration tests for recommendation profile caching."""

from tests.conftest import requires_db
from tests.helpers.seed_ready_films import DEFAULT_QUESTIONNAIRE, seed_ready_films

pytestmark = requires_db


def test_identical_questionnaire_profile_cache_hit(integration_client, db_session):
    seed_ready_films(db_session, count=5)
    payload = {"questionnaire": DEFAULT_QUESTIONNAIRE, "notes": "Same notes"}

    first = integration_client.post("/api/v1/recommendations", json=payload)
    second = integration_client.post("/api/v1/recommendations", json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["profile_cache_hit"] is False
    assert second.json()["profile_cache_hit"] is True
    assert first.json()["profile_id"] == second.json()["profile_id"]

    detail = integration_client.get(
        f"/api/v1/recommendations/{second.json()['session_id']}"
    ).json()
    assert detail["profile_cache_hit"] is True
