"""Close-to-this similarity over unwatched watchlist embeddings."""

from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.database.enums import EmbeddingType, FilmStatus
from app.repositories import film_embedding_repository, film_repository, system_version_repository
from app.schemas.film_schemas import SimilarFilm
from app.services.film_presenter import film_to_similar

_SIMILAR_SQL = text(
    """
    SELECT other.film_id
    FROM film_embeddings source
    JOIN film_embeddings other
      ON other.embedding_type = source.embedding_type
     AND other.embedding_version = source.embedding_version
     AND other.film_id <> source.film_id
    JOIN films f ON f.id = other.film_id
    JOIN watchlist_entries we
      ON we.film_id = f.id
     AND we.active IS TRUE
    WHERE source.film_id = :film_id
      AND source.embedding_type = :embedding_type
      AND source.embedding_version = :embedding_version
      AND f.status = :film_status
    ORDER BY other.embedding <=> source.embedding
    LIMIT :limit
    """
)


def list_similar_films(db: Session, film_id: uuid.UUID, *, limit: int) -> list[SimilarFilm]:
    """Active watchlist films nearest this film's semantic embedding.

    An unknown film is a 404. A film with no embedding for the active version
    returns an empty list rather than neighbours from a different vector space.
    """
    film = film_repository.get_by_id(db, film_id)
    if film is None:
        raise not_found("Film")

    active_version = system_version_repository.get_active_version(db, "film-embedding")
    embedding_version = active_version.version if active_version else "embedding-v1"
    source = film_embedding_repository.get(
        db,
        film_id,
        EmbeddingType.SEMANTIC,
        embedding_version,
    )
    if source is None:
        return []

    rows = db.execute(
        _SIMILAR_SQL,
        {
            "film_id": film_id,
            "embedding_type": EmbeddingType.SEMANTIC.value,
            "embedding_version": embedding_version,
            "film_status": FilmStatus.ACTIVE.value,
            "limit": limit,
        },
    ).all()
    ordered_ids = [
        row.film_id if isinstance(row.film_id, uuid.UUID) else uuid.UUID(str(row.film_id))
        for row in rows
    ]
    films = film_repository.get_many_by_ids_with_relations(db, ordered_ids)
    by_id = {item.id: item for item in films}
    return [film_to_similar(by_id[film_id]) for film_id in ordered_ids if film_id in by_id]
