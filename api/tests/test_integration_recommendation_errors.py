"""Integration tests for recommendation API error responses."""

from tests.conftest import requires_db
from tests.helpers.seed_ready_films import DEFAULT_QUESTIONNAIRE, seed_ready_films

pytestmark = requires_db


def test_no_preference_conflict_on_post_recommendations(integration_client, db_session):
    seed_ready_films(db_session, count=3)
    questionnaire = {**DEFAULT_QUESTIONNAIRE, "genres": ["No Preference", "Horror"]}
    response = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": questionnaire},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "NO_PREFERENCE_CONFLICT"
