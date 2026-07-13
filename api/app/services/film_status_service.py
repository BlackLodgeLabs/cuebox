"""Film status transition service."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import conflict, not_found
from app.database.enums import FilmStatus
from app.database.models import Film
from app.repositories import film_repository, watchlist_repository
from app.services.sync_service import MAX_ACTIVE_WATCHLIST


class FilmStatusService:
    @staticmethod
    def transition(db: Session, film_id: uuid.UUID, target_status: FilmStatus) -> Film:
        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise not_found("Film")

        if film.status == target_status:
            return film

        if film.status == FilmStatus.WATCHED and target_status == FilmStatus.ARCHIVED:
            raise conflict("Cannot transition from watched to archived")
        if film.status == FilmStatus.ARCHIVED and target_status == FilmStatus.WATCHED:
            raise conflict("Cannot transition from archived to watched")

        if target_status == FilmStatus.WATCHED:
            entry = watchlist_repository.get_active_by_film_id(db, film.id)
            if entry is not None:
                watchlist_repository.deactivate_entry(db, entry)
            film_repository.mark_watched(db, film)
        elif target_status == FilmStatus.ARCHIVED:
            entry = watchlist_repository.get_active_by_film_id(db, film.id)
            if entry is not None:
                watchlist_repository.deactivate_entry(db, entry)
            film_repository.archive_film(db, film)
        elif target_status == FilmStatus.ACTIVE:
            if watchlist_repository.count_active(db) >= MAX_ACTIVE_WATCHLIST:
                raise conflict("Active watchlist limit reached")
            film_repository.restore_active(db, film)
            watchlist_repository.ensure_active_entry(
                db,
                film_id=film.id,
                letterboxd_uri=film.letterboxd_uri,
            )

        db.flush()
        return film
