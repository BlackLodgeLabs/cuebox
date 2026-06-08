"""Film metadata data-access helpers."""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.database.models import FilmMetadata


def get_by_film_id(db: Session, film_id: uuid.UUID) -> FilmMetadata | None:
    return db.get(FilmMetadata, film_id)


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
