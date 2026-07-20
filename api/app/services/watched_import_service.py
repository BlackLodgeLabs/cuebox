"""Import Letterboxd watched-library CSVs into Cuebox watch history."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.database.enums import FilmStatus, WatchSource
from app.database.models import Film
from app.repositories import (
    film_repository,
    film_watch_repository,
    import_job_repository,
    watchlist_repository,
)
from app.services.import_service import schedule_enrichment_for_films
from app.services.provider_service import ProviderService
from app.services.watched_csv_parser import FilmImportPlan, merge_watched_exports

logger = logging.getLogger(__name__)


@dataclass
class WatchedImportFailure:
    title: str
    year: int | None
    letterboxd_uri: str
    reason: str


@dataclass
class WatchedImportResult:
    films_seen: int = 0
    films_created: int = 0
    watches_created: int = 0
    watches_skipped_duplicate: int = 0
    pending_review: int = 0
    enrichment_job_id: uuid.UUID | None = None
    failures: list[WatchedImportFailure] = field(default_factory=list)


class WatchedImportService:
    def __init__(self, provider_service: ProviderService) -> None:
        self._providers = provider_service

    def import_watched(
        self,
        db: Session,
        watched_bytes: bytes,
        ratings_bytes: bytes,
        diary_bytes: bytes,
        background_tasks: BackgroundTasks,
    ) -> WatchedImportResult:
        plans = merge_watched_exports(watched_bytes, ratings_bytes, diary_bytes)
        result = WatchedImportResult()
        films_to_enrich: list[uuid.UUID] = []
        job = import_job_repository.create(db, total_films=0)

        for plan in plans:
            try:
                film, created = self._resolve_or_create(db, plan, job.id)
                if created:
                    films_to_enrich.append(film.id)
                    result.films_created += 1
                result.films_seen += 1
                self._apply_plan(db, film, plan, result)
            except Exception as exc:
                logger.exception(
                    "Failed watched import for %s (%s)",
                    plan.title,
                    plan.letterboxd_uri,
                )
                result.failures.append(
                    WatchedImportFailure(
                        title=plan.title,
                        year=plan.year,
                        letterboxd_uri=plan.letterboxd_uri,
                        reason=str(exc) or "Import failed",
                    )
                )

        if films_to_enrich:
            import_job_repository.update_counters(db, job, total_films=len(films_to_enrich))
            result.enrichment_job_id = job.id
            schedule_enrichment_for_films(background_tasks, job.id, self._providers)
        else:
            import_job_repository.mark_complete(db, job)

        db.commit()
        return result

    def _resolve_or_create(
        self,
        db: Session,
        plan: FilmImportPlan,
        job_id: uuid.UUID,
    ) -> tuple[Film, bool]:
        film = film_repository.get_by_letterboxd_uri(db, plan.letterboxd_uri)
        if film is not None:
            return film, False

        film = film_repository.find_by_title_year(db, plan.title, plan.year)
        if film is not None:
            return film, False

        film = film_repository.create(
            db,
            title=plan.title,
            letterboxd_uri=plan.letterboxd_uri,
            year=plan.year,
            import_job_id=job_id,
        )
        return film, True

    def _apply_plan(
        self,
        db: Session,
        film: Film,
        plan: FilmImportPlan,
        result: WatchedImportResult,
    ) -> None:
        status = film.status

        if status == FilmStatus.WATCHED:
            self._add_completed_events(db, film, plan, result, force_completed=True)
            return

        if status == FilmStatus.PENDING_WATCH_REVIEW:
            if plan.needs_pending_review:
                self._upsert_pending_from_plan(db, film, plan, result)
            else:
                film_watch_repository.delete_pending_for_film(db, film.id)
                self._add_completed_events(db, film, plan, result, force_completed=False)
                film_repository.mark_watched(db, film)
            return

        # active or archived (or brand-new stub still defaulting to active)
        if status == FilmStatus.ACTIVE:
            entry = watchlist_repository.get_active_by_film_id(db, film.id)
            if entry is not None:
                watchlist_repository.deactivate_entry(db, entry)

        if plan.needs_pending_review:
            film_repository.mark_pending_watch_review(db, film)
            self._upsert_pending_from_plan(db, film, plan, result)
        else:
            self._add_completed_events(db, film, plan, result, force_completed=False)
            film_repository.mark_watched(db, film)

    def _add_completed_events(
        self,
        db: Session,
        film: Film,
        plan: FilmImportPlan,
        result: WatchedImportResult,
        *,
        force_completed: bool,
    ) -> None:
        for event in plan.events:
            score = event.score
            # Already-watched films: unscored diary dates become completed null-score rows.
            if force_completed or event.completed:
                created = self._create_completed_if_new(
                    db,
                    film_id=film.id,
                    watched_at=event.watched_at,
                    score=score if event.completed else None,
                )
                if created:
                    result.watches_created += 1
                else:
                    result.watches_skipped_duplicate += 1

    def _upsert_pending_from_plan(
        self,
        db: Session,
        film: Film,
        plan: FilmImportPlan,
        result: WatchedImportResult,
    ) -> None:
        pending_events = [e for e in plan.events if not e.completed]
        if not pending_events:
            return

        sorted_dates = sorted(e.watched_at for e in pending_events)
        earliest = sorted_dates[0]
        staged = [d.isoformat() for d in sorted_dates[1:]]

        existing = film_watch_repository.get_pending_for_film(db, film.id)
        if existing is None:
            film_watch_repository.create_pending(
                db,
                film_id=film.id,
                source=WatchSource.LETTERBOXD_IMPORT,
                watched_at=earliest,
                score=None,
                staged_watched_dates=staged or None,
            )
        else:
            film_watch_repository.update_pending_prefill(
                db,
                existing,
                watched_at=earliest,
                staged_watched_dates=staged or [],
            )
        result.pending_review += 1

    def _create_completed_if_new(
        self,
        db: Session,
        *,
        film_id: uuid.UUID,
        watched_at,
        score: float | None,
    ) -> bool:
        existing = film_watch_repository.get_completed_by_film_and_date(
            db, film_id, watched_at
        )
        if existing is not None:
            return False
        film_watch_repository.create_completed(
            db,
            film_id=film_id,
            source=WatchSource.LETTERBOXD_IMPORT,
            watched_at=watched_at,
            score=score,
        )
        return True
