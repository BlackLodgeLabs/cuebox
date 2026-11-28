"""Film list rows carry the synopsis and mood Home uses to fill its rails."""

import uuid
from datetime import UTC, datetime

from app.database.enums import EnrichmentStatus, FilmStatus
from app.database.models import Film, FilmMetadata, FilmSemanticProfile
from app.services.film_presenter import film_to_summary


def test_summary_includes_synopsis_and_mood_for_home_rails():
    film = Film(
        title="The Wicker Man",
        year=1973,
        letterboxd_uri="https://letterboxd.com/film/the-wicker-man/",
        status=FilmStatus.ACTIVE,
        enrichment_status=EnrichmentStatus.READY,
        created_at=datetime(2024, 1, 1, tzinfo=UTC),
        updated_at=datetime(2024, 1, 1, tzinfo=UTC),
    )
    film.id = uuid.uuid4()
    film.metadata_ = FilmMetadata(
        film_id=film.id,
        synopsis="A devout policeman lands on a Hebridean island.",
        genres=["Folk horror"],
        runtime=88,
        keywords=[],
    )
    film.semantic_profile = FilmSemanticProfile(
        film_id=film.id,
        tones=["dread", "folk"],
        emotional_outcomes=["unease"],
        subgenres=[],
        themes=[],
        visual_descriptors=[],
        viewing_contexts=[],
        semantic_version="1",
        generated_by_model="test",
        generated_at=datetime(2024, 1, 1, tzinfo=UTC),
    )

    summary = film_to_summary(film)

    assert summary.synopsis == "A devout policeman lands on a Hebridean island."
    assert summary.tones == ["dread", "folk"]
    assert summary.emotional_outcomes == ["unease"]
    assert summary.genres == ["Folk horror"]
    assert summary.runtime == 88


def test_summary_mood_is_empty_without_metadata():
    film = Film(
        title="Bare",
        year=None,
        letterboxd_uri="https://letterboxd.com/film/bare/",
        status=FilmStatus.ACTIVE,
        enrichment_status=EnrichmentStatus.PENDING,
        created_at=datetime(2024, 1, 1, tzinfo=UTC),
        updated_at=datetime(2024, 1, 1, tzinfo=UTC),
    )
    film.id = uuid.uuid4()

    summary = film_to_summary(film)

    assert summary.synopsis is None
    assert summary.tones == []
    assert summary.emotional_outcomes == []
