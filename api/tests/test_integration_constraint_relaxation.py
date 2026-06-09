"""Integration test for constraint relaxation recording."""

from app.repositories import film_metadata_repository
from tests.conftest import requires_db
from tests.helpers.seed_ready_films import seed_ready_films

pytestmark = requires_db


def test_runtime_relaxation_recorded(integration_client, db_session):
    films = seed_ready_films(db_session, count=5)
    for film in films:
        film_metadata_repository.upsert(db_session, film.id, runtime=110)
    db_session.commit()

    questionnaire = {
        "genres": ["Horror"],
        "runtime": "le_90",
        "viewing_context": "solo",
        "thinking_effort": "decent_plot",
        "pacing": "slow_burn",
        "emotional_outcomes": ["Disturbed"],
        "visual_tonal_vibes": ["Atmospheric"],
        "era": "modern_classics",
        "subtitle_preference": "no_preference",
        "obscurity_preference": "hidden_gems",
    }
    response = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": questionnaire},
    )
    assert response.status_code == 200
    relaxation = response.json().get("constraint_relaxation")
    assert relaxation is not None
    assert "runtime_minutes" in relaxation
