"""Watch review completion, cancellation, and edit service."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import conflict, not_found, unprocessable
from app.database.enums import FilmStatus, WatchSource
from app.database.models import Film
from app.repositories import film_repository, film_watch_repository, watchlist_repository
from app.services.film_status_service import FilmStatusService
from app.services.sync_service import MAX_ACTIVE_WATCHLIST


def _validate_score(score: float) -> float:
    if score < 0.5 or score > 5.0:
        raise unprocessable("Score must be between 0.5 and 5.0")
    rounded = round(score * 2) / 2
    if abs(rounded - score) > 0.001:
        raise unprocessable("Score must be in 0.5 steps")
    return rounded


def _validate_watched_at(watched_at: date) -> date:
    today = datetime.now(timezone.utc).date()
    if watched_at > today:
        raise unprocessable("Watched date cannot be in the future")
    return watched_at


class WatchReviewService:
    @staticmethod
    def complete_review(
        db: Session,
        film_id: uuid.UUID,
        *,
        score: float,
        watched_at: date,
        notes: str | None = None,
    ) -> Film:
        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise not_found("Film")
        if film.status != FilmStatus.PENDING_WATCH_REVIEW:
            raise conflict("Film is not pending watch review")

        validated_score = _validate_score(score)
        validated_date = _validate_watched_at(watched_at)

        pending = film_watch_repository.get_pending_for_film(db, film_id)
        if pending is None:
            raise conflict("No pending watch record found")

        film_watch_repository.finalize_pending(
            db,
            pending,
            score=validated_score,
            watched_at=validated_date,
            notes=notes,
        )
        film_repository.mark_watched(db, film)
        db.flush()
        return film

    @staticmethod
    def cancel_review(db: Session, film_id: uuid.UUID) -> Film:
        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise not_found("Film")
        if film.status != FilmStatus.PENDING_WATCH_REVIEW:
            raise conflict("Film is not pending watch review")

        film_watch_repository.delete_pending_for_film(db, film_id)

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

    @staticmethod
    def edit_watch(
        db: Session,
        film_id: uuid.UUID,
        watch_id: uuid.UUID,
        *,
        score: float,
        watched_at: date,
        notes: str | None = None,
    ):
        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise not_found("Film")

        watch = film_watch_repository.get_by_id(db, watch_id)
        if watch is None or watch.film_id != film_id:
            raise not_found("Watch record")
        if watch.is_pending:
            raise conflict("Cannot edit a pending watch record")

        validated_score = _validate_score(score)
        validated_date = _validate_watched_at(watched_at)

        return film_watch_repository.update_watch(
            db,
            watch,
            score=validated_score,
            watched_at=validated_date,
            notes=notes,
        )

    @staticmethod
    def begin_manual_review(db: Session, film_id: uuid.UUID) -> Film:
        """Transition active film to pending_watch_review with a draft watch record."""
        film = FilmStatusService.transition(db, film_id, FilmStatus.PENDING_WATCH_REVIEW)
        today = datetime.now(timezone.utc).date()
        existing = film_watch_repository.get_pending_for_film(db, film_id)
        if existing is None:
            film_watch_repository.create_pending(
                db,
                film_id=film_id,
                source=WatchSource.MANUAL,
                watched_at=today,
            )
        db.flush()
        return film
