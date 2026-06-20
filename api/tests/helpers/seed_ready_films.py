"""Seed ready films for recommendation integration tests."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.database.enums import EmbeddingType, EnrichmentStatus, FilmStatus
from app.providers.semantic.base import SemanticProfileResult
from app.repositories import (
    film_embedding_repository,
    film_metadata_repository,
    film_repository,
    import_job_repository,
    semantic_profile_repository,
    watchlist_repository,
)
from tests.mock_providers import DEFAULT_SEMANTIC_PROFILE, mock_embedding_vector


def seed_ready_films(db: Session, count: int = 5) -> list:
    job = import_job_repository.create(db, total_films=count)
    films = []
    for index in range(count):
        suffix = uuid.uuid4().hex[:8]
        film = film_repository.create(
            db,
            title=f"Ready Film {index}",
            letterboxd_uri=f"https://letterboxd.com/film/ready-{suffix}/",
            year=1990 + (index % 25),
            import_job_id=job.id,
        )
        film.status = FilmStatus.ACTIVE
        film.enrichment_status = EnrichmentStatus.READY
        film_metadata_repository.upsert(
            db,
            film.id,
            tmdb_id=10000 + index,
            runtime=100 + index * 5,
            synopsis=f"A compelling story about film {index}.",
            genres=["Horror", "Drama"],
            keywords=["atmospheric"],
            original_language="en",
            director=f"Director {index}",
            tmdb_rating=Decimal("7.5"),
            rotten_tomatoes_score=88,
            poster_url=f"https://image.tmdb.org/t/p/w500/seed-poster-{index}.jpg",
            match_confidence=Decimal("0.9800"),
            metadata_source="tmdb",
        )
        semantic_profile_repository.upsert(
            db,
            film.id,
            SemanticProfileResult(
                subgenres=DEFAULT_SEMANTIC_PROFILE["subgenres"],
                themes=DEFAULT_SEMANTIC_PROFILE["themes"],
                tones=DEFAULT_SEMANTIC_PROFILE["tones"],
                visual_descriptors=DEFAULT_SEMANTIC_PROFILE["visual_descriptors"],
                emotional_outcomes=DEFAULT_SEMANTIC_PROFILE["emotional_outcomes"],
                viewing_contexts=["solo viewing"],
                complexity=6.0,
                pacing=4.0,
                energy=5.0,
                obscurity=4.0,
                semantic_summary=DEFAULT_SEMANTIC_PROFILE["semantic_summary"],
            ),
            semantic_version="semantic-v1",
            generated_by_model="gpt-4o-mini",
        )
        film_embedding_repository.upsert(
            db,
            film.id,
            embedding_type=EmbeddingType.SEMANTIC,
            embedding_version="embedding-v1",
            embedding_model="text-embedding-3-small",
            vector=mock_embedding_vector(f"film-{index}"),
        )
        watchlist_repository.create_active_entry(
            db,
            film_id=film.id,
            letterboxd_uri=film.letterboxd_uri,
        )
        films.append(film)
    import_job_repository.mark_complete(db, job)
    db.commit()
    return films


DEFAULT_QUESTIONNAIRE = {
    "genres": ["Horror"],
    "runtime": "le_120",
    "viewing_context": "solo",
    "thinking_effort": "decent_plot",
    "pacing": "slow_burn",
    "emotional_outcomes": ["Disturbed"],
    "visual_tonal_vibes": ["Atmospheric"],
    "era": "modern_classics",
    "subtitle_preference": "no_preference",
    "obscurity_preference": "hidden_gems",
}
