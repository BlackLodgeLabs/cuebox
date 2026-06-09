"""Film embedding data-access helpers."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.database.enums import EmbeddingType
from app.database.models import FilmEmbedding


def get(
    db: Session,
    film_id: uuid.UUID,
    embedding_type: EmbeddingType,
    embedding_version: str,
) -> FilmEmbedding | None:
    return db.get(FilmEmbedding, (film_id, embedding_type, embedding_version))


def upsert(
    db: Session,
    film_id: uuid.UUID,
    *,
    embedding_type: EmbeddingType,
    embedding_version: str,
    embedding_model: str,
    vector: list[float],
) -> FilmEmbedding:
    row = get(db, film_id, embedding_type, embedding_version)
    if row is None:
        row = FilmEmbedding(
            film_id=film_id,
            embedding_type=embedding_type,
            embedding_version=embedding_version,
            embedding_model=embedding_model,
            embedding=vector,
            generated_at=datetime.now(UTC),
        )
        db.add(row)
    else:
        row.embedding_model = embedding_model
        row.embedding = vector
        row.generated_at = datetime.now(UTC)
    db.flush()
    return row
