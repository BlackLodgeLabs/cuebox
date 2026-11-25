"""Watch review completion, cancellation, and edit service."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import conflict, not_found, unprocessable
from app.database.enums import FilmStatus, WatchSource
from app.database.models import Film
from app.repositories import film_repository, film_watch_repository, watchlist_repository
from app.schemas.watch_review_schemas import UpdateWatchRequest
from app.services.film_status_service import FilmStatusService
from app.services.sync_service import MAX_ACTIVE_WATCHLIST
from app.services.watched_csv_parser import DEFAULT_WATCHED_AT


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


def _ensure_completed_date_available(
    db: Session,
    film_id: uuid.UUID,
    watched_at: date,
    *,
    ignore_watch_id: uuid.UUID | None = None,
) -> None:
    existing = film_watch_repository.get_completed_by_film_and_date(db, film_id, watched_at)
    if existing is not None and existing.id != ignore_watch_id:
        raise conflict("A completed watch already exists on that date")


def _finalize_pending_draft(
    db: Session,
    film: Film,
    *,
    score: float,
    watched_at: date | None,
    notes: str | None,
) -> None:
    pending = film_watch_repository.get_pending_for_film(db, film.id)
    if pending is None:
        raise conflict("No pending watch record found")
    if watched_at is not None:
        _ensure_completed_date_available(db, film.id, watched_at)

    staged_dates = list(pending.staged_watched_dates or [])
    pending_source = pending.source
    film_watch_repository.finalize_pending(
        db,
        pending,
        score=score,
        watched_at=watched_at,
        notes=notes,
    )

    for raw in staged_dates:
        try:
            staged_at = date.fromisoformat(str(raw))
        except ValueError:
            continue
        if staged_at == watched_at:
            continue
        if pending_source == WatchSource.MANUAL and staged_at == DEFAULT_WATCHED_AT:
            continue
        existing = film_watch_repository.get_completed_by_film_and_date(db, film.id, staged_at)
        if existing is not None:
            continue
        film_watch_repository.create_completed(
            db,
            film_id=film.id,
            source=pending_source,
            watched_at=staged_at,
            score=score,
        )

    film_repository.mark_watched(db, film)


def _create_manual_watch(
    db: Session,
    film: Film,
    *,
    score: float,
    watched_at: date | None,
    notes: str | None,
) -> None:
    if watched_at is not None:
        _ensure_completed_date_available(db, film.id, watched_at)
    film_watch_repository.create_completed(
        db,
        film_id=film.id,
        source=WatchSource.MANUAL,
        watched_at=watched_at,
        score=score,
        notes=notes,
    )


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
        _finalize_pending_draft(
            db,
            film,
            score=validated_score,
            watched_at=validated_date,
            notes=notes,
        )
        db.flush()
        return film

    @staticmethod
    def create_watch(
        db: Session,
        film_id: uuid.UUID,
        *,
        score: float,
        watched_at: date | None,
        notes: str | None = None,
    ) -> Film:
        """Create a finalized manual watch from the star tap."""
        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise not_found("Film")
        if film.status == FilmStatus.ARCHIVED:
            raise conflict("Cannot transition from archived to watched")

        validated_score = _validate_score(score)
        validated_date = None if watched_at is None else _validate_watched_at(watched_at)

        if film.status == FilmStatus.PENDING_WATCH_REVIEW:
            _finalize_pending_draft(
                db,
                film,
                score=validated_score,
                watched_at=validated_date,
                notes=notes,
            )
        elif film.status in (FilmStatus.ACTIVE, FilmStatus.WATCHED):
            if film.status == FilmStatus.ACTIVE:
                entry = watchlist_repository.get_active_by_film_id(db, film.id)
                if entry is not None:
                    watchlist_repository.deactivate_entry(db, entry)
                film_repository.mark_watched(db, film)
            _create_manual_watch(
                db,
                film,
                score=validated_score,
                watched_at=validated_date,
                notes=notes,
            )
        else:
            raise conflict("Cannot log a watch for this film")

        db.flush()
        return film

    @staticmethod
    def cancel_review(db: Session, film_id: uuid.UUID) -> Film:
        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise not_found("Film")
        if film.status != FilmStatus.PENDING_WATCH_REVIEW:
            raise conflict("Film is not pending watch review")

        pending = film_watch_repository.get_pending_for_film(db, film_id)
        pending_source = pending.source if pending is not None else None
        film_watch_repository.delete_pending_for_film(db, film_id)

        had_watchlist = watchlist_repository.has_any_entry_for_film(db, film_id)
        if (
            pending_source == WatchSource.LETTERBOXD_IMPORT
            and not had_watchlist
        ):
            film_repository.archive_film(db, film)
            db.flush()
            return film

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
        body: UpdateWatchRequest,
    ):
        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise not_found("Film")

        watch = film_watch_repository.get_by_id(db, watch_id)
        if watch is None or watch.film_id != film_id:
            raise not_found("Watch record")
        if watch.is_pending:
            raise conflict("Cannot edit a pending watch record")

        provided = body.model_fields_set
        updates: dict = {}
        if "score" in provided:
            if body.score is None:
                raise unprocessable("Score cannot be null")
            updates["score"] = _validate_score(body.score)
        if "watched_at" in provided:
            if body.watched_at is None:
                updates["watched_at"] = None
            else:
                updates["watched_at"] = _validate_watched_at(body.watched_at)
                _ensure_completed_date_available(
                    db,
                    film_id,
                    updates["watched_at"],
                    ignore_watch_id=watch.id,
                )
        if "notes" in provided:
            updates["notes"] = body.notes

        return film_watch_repository.update_watch(db, watch, **updates)

    @staticmethod
    def delete_watch(db: Session, film_id: uuid.UUID, watch_id: uuid.UUID) -> None:
        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise not_found("Film")

        watch = film_watch_repository.get_by_id(db, watch_id)
        if watch is None or watch.film_id != film_id:
            raise not_found("Watch record")
        if watch.is_pending:
            raise conflict("Cannot delete a pending watch; cancel the watch review instead")

        film_watch_repository.delete_watch(db, watch)

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
