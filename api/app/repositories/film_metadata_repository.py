"""Film metadata data-access helpers."""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.database.models import FilmMetadata


def get_by_film_id(db: Session, film_id: uuid.UUID) -> FilmMetadata | None:
    return db.get(FilmMetadata, film_id)


def get_by_tmdb_id(
    db: Session,
    tmdb_id: int,
    *,
    exclude_film_id: uuid.UUID | None = None,
) -> FilmMetadata | None:
    from sqlalchemy import select

    stmt = select(FilmMetadata).where(FilmMetadata.tmdb_id == tmdb_id)
    if exclude_film_id is not None:
        stmt = stmt.where(FilmMetadata.film_id != exclude_film_id)
    return db.scalar(stmt)


def get_by_imdb_id(
    db: Session,
    imdb_id: str,
    *,
    exclude_film_id: uuid.UUID | None = None,
) -> FilmMetadata | None:
    from sqlalchemy import select

    stmt = select(FilmMetadata).where(FilmMetadata.imdb_id == imdb_id)
    if exclude_film_id is not None:
        stmt = stmt.where(FilmMetadata.film_id != exclude_film_id)
    return db.scalar(stmt)


def upsert(db: Session, film_id: uuid.UUID, **fields: Any) -> FilmMetadata:
    metadata = get_by_film_id(db, film_id)
    if metadata is None:
        metadata = FilmMetadata(film_id=film_id, **fields)
        db.add(metadata)
    else:
        for key, value in fields.items():
            setattr(metadata, key, value)
    db.flush()
    return metadata
