"""GET /films/{film_id}/similar — unwatched watchlist neighbours by embedding."""

from __future__ import annotations

import uuid

from app.database.enums import EmbeddingType, EnrichmentStatus, FilmStatus
from app.providers.embedding.base import EMBEDDING_DIMENSION
from app.providers.semantic.base import SemanticProfileResult
from app.repositories import (
    film_embedding_repository,
    film_metadata_repository,
    film_repository,
    import_job_repository,
    semantic_profile_repository,
    watchlist_repository,
)


def _vector(primary: int, primary_value: float = 1.0, secondary: tuple[int, float] | None = None) -> list[float]:
    vector = [0.0] * EMBEDDING_DIMENSION
    vector[primary] = primary_value
    if secondary is not None:
        index, value = secondary
        vector[index] = value
    return vector


def _seed_film(
    db_session,
    job_id,
    *,
    title: str,
    status: FilmStatus = FilmStatus.ACTIVE,
    watchlist: str = "active",
    embedding: list[float] | None = None,
    semantic_summary: str | None = None,
    tmdb_id: int | None = None,
):
    suffix = uuid.uuid4().hex[:8]
    film = film_repository.create(
        db_session,
        title=title,
        letterboxd_uri=f"https://letterboxd.com/film/{title.lower().replace(' ', '-')}-{suffix}/",
        year=1999,
        import_job_id=job_id,
    )
    film.status = status
    film.enrichment_status = EnrichmentStatus.READY
    if tmdb_id is not None:
        film_metadata_repository.upsert(
            db_session,
            film.id,
            tmdb_id=tmdb_id,
            director="Director",
            metadata_source="tmdb",
        )
    if semantic_summary is not None:
        semantic_profile_repository.upsert(
            db_session,
            film.id,
            SemanticProfileResult(
                subgenres=[],
                themes=[],
                tones=[],
                visual_descriptors=[],
                emotional_outcomes=[],
                viewing_contexts=[],
                complexity=None,
                pacing=None,
                energy=None,
                obscurity=None,
                semantic_summary=semantic_summary,
            ),
            semantic_version="semantic-v1",
            generated_by_model="test",
        )
    if embedding is not None:
        film_embedding_repository.upsert(
            db_session,
            film.id,
            embedding_type=EmbeddingType.SEMANTIC,
            embedding_version="embedding-v1",
            embedding_model="text-embedding-3-small",
            vector=embedding,
        )
    if watchlist == "active":
        watchlist_repository.create_active_entry(
            db_session,
            film_id=film.id,
            letterboxd_uri=film.letterboxd_uri,
        )
    elif watchlist == "removed":
        entry = watchlist_repository.create_active_entry(
            db_session,
            film_id=film.id,
            letterboxd_uri=film.letterboxd_uri,
        )
        watchlist_repository.deactivate_entry(db_session, entry)
    return film


def test_similar_returns_active_watchlist_films_by_closeness(integration_client, db_session):
    job = import_job_repository.create(db_session, total_films=6)
    source = _seed_film(
        db_session,
        job.id,
        title="Source Film",
        embedding=_vector(0),
        tmdb_id=60301,
    )
    near = _seed_film(
        db_session,
        job.id,
        title="Near Film",
        embedding=_vector(0, secondary=(1, 0.2)),
        semantic_summary="A rain-soaked noir about loyalty.",
        tmdb_id=60302,
    )
    far = _seed_film(
        db_session,
        job.id,
        title="Far Film",
        embedding=_vector(1, primary_value=1.0, secondary=(0, 0.15)),
        tmdb_id=60303,
    )
    watched = _seed_film(
        db_session,
        job.id,
        title="Watched Twin",
        status=FilmStatus.WATCHED,
        embedding=_vector(0),
        tmdb_id=60304,
    )
    removed = _seed_film(
        db_session,
        job.id,
        title="Removed Closer",
        watchlist="removed",
        embedding=_vector(0, secondary=(1, 0.05)),
        tmdb_id=60305,
    )
    pending = _seed_film(
        db_session,
        job.id,
        title="Pending Review",
        status=FilmStatus.PENDING_WATCH_REVIEW,
        embedding=_vector(0, secondary=(1, 0.01)),
        tmdb_id=60306,
    )
    db_session.commit()

    response = integration_client.get(f"/api/v1/films/{source.id}/similar")
    assert response.status_code == 200
    body = response.json()
    ids = [item["id"] for item in body]
    assert ids == [str(near.id), str(far.id)]
    assert str(source.id) not in ids
    assert str(watched.id) not in ids
    assert str(removed.id) not in ids
    assert str(pending.id) not in ids
    assert body[0]["title"] == "Near Film"
    assert body[0]["semantic_line"] == "A rain-soaked noir about loyalty."
    assert body[0]["tmdb_id"] == 60302
    assert body[1]["semantic_line"] is None

    limited = integration_client.get(f"/api/v1/films/{source.id}/similar?limit=1")
    assert limited.status_code == 200
    assert [item["id"] for item in limited.json()] == [str(near.id)]


def test_similar_without_embedding_is_empty(integration_client, db_session):
    job = import_job_repository.create(db_session, total_films=1)
    bare = _seed_film(db_session, job.id, title="No Embedding")
    db_session.commit()

    response = integration_client.get(f"/api/v1/films/{bare.id}/similar")
    assert response.status_code == 200
    assert response.json() == []


def test_similar_missing_film_is_not_found(integration_client):
    response = integration_client.get(f"/api/v1/films/{uuid.uuid4()}/similar")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
