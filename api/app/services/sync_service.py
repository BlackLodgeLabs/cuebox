"""Watchlist synchronisation — CSV diff and RSS event application."""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass, field

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.core.exceptions import watchlist_size_exceeded
from app.database.enums import EnrichmentStatus, FilmStatus, RssEventType
from app.database.models import Film
from app.repositories import (
    film_repository,
    import_job_repository,
    rss_sync_repository,
    sync_config_repository,
    watchlist_repository,
)
from app.services.csv_parser import ParsedWatchlistRow, parse_watchlist_csv
from app.services.import_service import schedule_enrichment_for_films
from app.services.provider_service import ProviderService
from app.services.rss_parser import (
    DIARY_FEED_URL,
    RssEvent,
    fetch_feed,
    parse_diary_feed,
)

logger = logging.getLogger(__name__)

MAX_ACTIVE_WATCHLIST = 500
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,50}$")


@dataclass
class CsvDiffResult:
    added: list[ParsedWatchlistRow] = field(default_factory=list)
    unchanged: int = 0


@dataclass
class SyncApplyResult:
    added: int = 0
    unchanged: int = 0
    failed: int = 0
    added_films: list[dict] = field(default_factory=list)
    enrichment_job_id: uuid.UUID | None = None
    enrichment_film_ids: list[uuid.UUID] = field(default_factory=list)


class SyncService:
    def __init__(self, provider_service: ProviderService) -> None:
        self._providers = provider_service

    def validate_username(self, username: str) -> str:
        if not USERNAME_PATTERN.match(username):
            from app.core.exceptions import validation_error

            raise validation_error("Invalid username format or length")
        return username

    def csv_diff(self, db: Session, parsed_rows: list[ParsedWatchlistRow]) -> CsvDiffResult:
        csv_by_uri = {row.letterboxd_uri: row for row in parsed_rows}
        result = CsvDiffResult()

        for uri, row in csv_by_uri.items():
            existing = film_repository.get_by_letterboxd_uri(db, uri)
            if existing is None:
                result.added.append(row)
            else:
                result.unchanged += 1

        if watchlist_repository.count_active(db) + len(result.added) > MAX_ACTIVE_WATCHLIST:
            raise watchlist_size_exceeded(
                "Post-sync active watchlist would exceed 500 films"
            )
        return result

    def apply_csv_diff(
        self,
        db: Session,
        diff: CsvDiffResult,
        background_tasks: BackgroundTasks,
    ) -> SyncApplyResult:
        outcome = SyncApplyResult(unchanged=diff.unchanged)
        films_to_enrich: list[uuid.UUID] = []
        sync_job = import_job_repository.create(db, total_films=0)

        for row in diff.added:
            try:
                existing = film_repository.get_by_letterboxd_uri(db, row.letterboxd_uri)
                if existing is not None:
                    continue
                film = film_repository.create(
                    db,
                    title=row.title,
                    letterboxd_uri=row.letterboxd_uri,
                    year=row.year,
                    import_job_id=sync_job.id,
                )
                watchlist_repository.create_active_entry(
                    db,
                    film_id=film.id,
                    letterboxd_uri=row.letterboxd_uri,
                )
                films_to_enrich.append(film.id)
                outcome.added += 1
                outcome.added_films.append(_film_summary(film))
            except Exception:
                logger.exception("Failed to add film during CSV sync: %s", row.letterboxd_uri)
                outcome.failed += 1

        if films_to_enrich:
            import_job_repository.update_counters(db, sync_job, total_films=len(films_to_enrich))
            outcome.enrichment_job_id = sync_job.id
            outcome.enrichment_film_ids = films_to_enrich
            schedule_enrichment_for_films(
                background_tasks,
                sync_job.id,
                self._providers,
            )
        else:
            import_job_repository.mark_complete(db, sync_job)

        db.commit()
        return outcome

    def sync_csv(
        self,
        db: Session,
        content: bytes,
        background_tasks: BackgroundTasks,
    ) -> SyncApplyResult:
        parsed = parse_watchlist_csv(content)
        diff = self.csv_diff(db, parsed.rows)
        return self.apply_csv_diff(db, diff, background_tasks)

    def configure_rss(self, db: Session, username: str):
        validated = self.validate_username(username)
        config = sync_config_repository.upsert_rss_username(db, validated)
        db.commit()
        db.refresh(config)
        return config

    def get_rss_status(self, db: Session) -> dict:
        config = sync_config_repository.get_config(db)
        if config is None or not config.rss_username:
            return {
                "configured": False,
                "username": None,
                "polling_interval_seconds": sync_config_repository.POLLING_INTERVAL_SECONDS,
                "last_polled_at": None,
                "last_poll_status": None,
                "events_processed_last_poll": None,
            }
        return {
            "configured": True,
            "username": config.rss_username,
            "polling_interval_seconds": sync_config_repository.POLLING_INTERVAL_SECONDS,
            "last_polled_at": config.last_polled_at,
            "last_poll_status": config.last_poll_status,
            "events_processed_last_poll": config.events_processed_last_poll,
        }

    async def poll_rss(self, db: Session | None = None) -> int:
        from app.database.session import SessionLocal

        own_session = db is None
        if own_session:
            db = SessionLocal()
        assert db is not None

        processed_count = 0
        jobs_to_start: list[uuid.UUID] = []
        try:
            config = sync_config_repository.get_config(db)
            if config is None or not config.rss_username:
                return 0

            username = config.rss_username
            client = self._providers.http_client
            if client is None:
                raise RuntimeError("HTTP client not available for RSS poll")

            diary_xml = await fetch_feed(
                client, DIARY_FEED_URL.format(username=username)
            )
            all_events = parse_diary_feed(diary_xml)

            for event in all_events:
                if rss_sync_repository.event_exists(db, event.event_id):
                    continue
                row = rss_sync_repository.create_event(
                    db,
                    event_id=event.event_id,
                    event_type=event.event_type,
                    event_timestamp=event.event_timestamp,
                    letterboxd_uri=event.letterboxd_uri,
                    payload=event.payload,
                )
                if self._apply_rss_event(db, event, row, jobs_to_start):
                    processed_count += 1

            sync_config_repository.update_poll_status(
                db, status="success", events_processed=processed_count
            )
            db.commit()

            import asyncio

            from app.services.import_service import run_import_enrichment

            for job_id in jobs_to_start:
                asyncio.create_task(run_import_enrichment(job_id, self._providers))
        except Exception:
            logger.exception("RSS poll failed")
            processed_count = 0
            try:
                db.rollback()
                sync_config_repository.update_poll_status(
                    db, status="error", events_processed=0
                )
                db.commit()
            except Exception:
                logger.exception("Failed to record RSS poll error status")
                db.rollback()
            raise
        finally:
            if own_session:
                db.close()
        return processed_count

    def _apply_rss_event(
        self,
        db: Session,
        event: RssEvent,
        row,
        jobs_to_start: list[uuid.UUID],
    ) -> bool:
        if row.processed:
            return False

        uri = event.letterboxd_uri
        if not uri:
            rss_sync_repository.mark_processed(db, row)
            return True

        if event.event_type == RssEventType.WATCHLIST_ADD:
            self._apply_watchlist_add(db, uri, event.payload, jobs_to_start)
        elif event.event_type == RssEventType.WATCHLIST_REMOVE:
            self._apply_watchlist_remove(db, uri)
        elif event.event_type == RssEventType.WATCHED:
            self._apply_watched(db, uri, event.payload)

        rss_sync_repository.mark_processed(db, row)
        return True

    def _apply_watchlist_add(
        self,
        db: Session,
        uri: str,
        payload: dict,
        jobs_to_start: list[uuid.UUID],
    ) -> None:
        if (
            watchlist_repository.get_active_by_uri(db, uri) is None
            and watchlist_repository.count_active(db) >= MAX_ACTIVE_WATCHLIST
        ):
            logger.warning("Skipping RSS watchlist add at cap: %s", uri)
            return
        existing = film_repository.get_by_letterboxd_uri(db, uri)
        title = payload.get("title") or "Unknown"
        year = payload.get("year")
        job = None
        if existing is not None:
            if existing.status != FilmStatus.ACTIVE:
                film_repository.restore_active(db, existing)
            watchlist_repository.ensure_active_entry(
                db, film_id=existing.id, letterboxd_uri=uri
            )
            if existing.enrichment_status != EnrichmentStatus.READY:
                job = import_job_repository.create(db, total_films=1)
                film_repository.reset_failed_for_retry(
                    db,
                    existing,
                    import_job_id=job.id,
                    title=title,
                    year=year,
                )
        else:
            job = import_job_repository.create(db, total_films=1)
            film = film_repository.create(
                db,
                title=title,
                letterboxd_uri=uri,
                year=year,
                import_job_id=job.id,
            )
            watchlist_repository.create_active_entry(
                db, film_id=film.id, letterboxd_uri=uri
            )
        if job is not None:
            jobs_to_start.append(job.id)

    def _apply_watchlist_remove(self, db: Session, uri: str) -> None:
        entry = watchlist_repository.get_active_by_uri(db, uri)
        if entry is None:
            return
        watchlist_repository.deactivate_entry(db, entry)
        film_repository.archive_film(db, entry.film)

    def _apply_watched(self, db: Session, uri: str, payload: dict | None = None) -> None:
        payload = payload or {}
        film, _ = film_repository.find_for_rss_watched(
            db,
            uri,
            title=payload.get("title"),
            year=payload.get("year"),
        )
        if film is None:
            return
        entry = watchlist_repository.get_active_by_film_id(db, film.id)
        if entry is not None:
            watchlist_repository.deactivate_entry(db, entry)
        film_repository.mark_watched(db, film)


def _film_summary(film: Film) -> dict:
    return {"film_id": film.id, "title": film.title, "year": film.year}
