"""History list status tag: post-recommendation views of the winner and runner-ups."""

import uuid
from datetime import date, datetime, timezone

from app.database.enums import FilmStatus, WatchSource
from app.database.models import RecommendationProfile, RecommendationResult, RecommendationSession
from app.repositories import film_repository, film_watch_repository
from tests.conftest import requires_db

pytestmark = requires_db

RECOMMENDED_AT = datetime(2024, 6, 15, 15, 0, tzinfo=timezone.utc)
DAY_AFTER = date(2024, 6, 16)
DAY_BEFORE = date(2024, 6, 14)


def _seed_session(
    db_session,
    *,
    winner_status: FilmStatus,
    winner_watch_on: list[date] | None = None,
    runner_watch_on: list[date] | None = None,
):
    suffix = uuid.uuid4().hex[:8]
    winner = film_repository.create_manual(
        db_session,
        title=f"Winner {suffix}",
        letterboxd_uri=f"https://letterboxd.com/film/winner-{suffix}/",
        year=1999,
    )
    runner = film_repository.create_manual(
        db_session,
        title=f"Runner {suffix}",
        letterboxd_uri=f"https://letterboxd.com/film/runner-{suffix}/",
        year=2001,
    )
    winner.status = winner_status
    profile = RecommendationProfile(
        profile_hash=uuid.uuid4().hex + uuid.uuid4().hex,
        structured_profile={"mood": "noir"},
        narrative_profile="A late-night pick.",
    )
    db_session.add(profile)
    db_session.flush()
    session = RecommendationSession(
        profile_id=profile.id,
        winner_film_id=winner.id,
        created_at=RECOMMENDED_AT,
    )
    db_session.add(session)
    db_session.flush()
    db_session.add(
        RecommendationResult(
            session_id=session.id,
            winner_explanation="Because it fits.",
            runner_up_explanations={str(runner.id): {"why": "close"}},
        )
    )
    for watched_on in winner_watch_on or []:
        film_watch_repository.create_completed(
            db_session,
            film_id=winner.id,
            source=WatchSource.MANUAL,
            watched_at=watched_on,
            score=4,
        )
    for watched_on in runner_watch_on or []:
        film_watch_repository.create_completed(
            db_session,
            film_id=runner.id,
            source=WatchSource.MANUAL,
            watched_at=watched_on,
            score=4,
        )
    db_session.commit()
    return session


def _history_item(integration_client, session_id: uuid.UUID) -> dict:
    response = integration_client.get("/api/v1/recommendations?limit=20")
    assert response.status_code == 200, response.text
    matches = [item for item in response.json()["data"] if item["session_id"] == str(session_id)]
    assert len(matches) == 1
    return matches[0]


def test_runner_up_watched_after_recommendation_sets_history_tag(
    integration_client, db_session
):
    session = _seed_session(
        db_session,
        winner_status=FilmStatus.ACTIVE,
        runner_watch_on=[DAY_AFTER],
    )

    item = _history_item(integration_client, session.id)

    assert item["winner_watch_status"] == "active"
    assert item["history_status_tag"] == "runner_up_watched"

    active = integration_client.get("/api/v1/recommendations?watch_status=active").json()
    assert any(row["session_id"] == str(session.id) for row in active["data"])
    watched = integration_client.get("/api/v1/recommendations?watch_status=watched").json()
    assert not any(row["session_id"] == str(session.id) for row in watched["data"])


def test_winner_view_after_recommendation_stays_watched_over_runner_up(
    integration_client, db_session
):
    session = _seed_session(
        db_session,
        winner_status=FilmStatus.ACTIVE,
        winner_watch_on=[DAY_AFTER],
        runner_watch_on=[DAY_AFTER],
    )

    item = _history_item(integration_client, session.id)

    assert item["history_status_tag"] == "watched"
    assert item["winner_watch_status"] == "active"


def test_runner_up_watched_only_before_recommendation_stays_active(
    integration_client, db_session
):
    session = _seed_session(
        db_session,
        winner_status=FilmStatus.ACTIVE,
        runner_watch_on=[DAY_BEFORE],
    )

    item = _history_item(integration_client, session.id)

    assert item["history_status_tag"] == "active"


def test_winner_view_only_before_recommendation_does_not_count_as_watched(
    integration_client, db_session
):
    session = _seed_session(
        db_session,
        winner_status=FilmStatus.WATCHED,
        winner_watch_on=[DAY_BEFORE],
    )

    item = _history_item(integration_client, session.id)

    assert item["winner_watch_status"] == "watched"
    assert item["history_status_tag"] == "active"


def test_archived_winner_without_a_later_view_keeps_archived(
    integration_client, db_session
):
    session = _seed_session(
        db_session,
        winner_status=FilmStatus.ARCHIVED,
    )

    item = _history_item(integration_client, session.id)

    assert item["history_status_tag"] == "archived"
