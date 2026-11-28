"""Fill and refresh the per-film flatrate cache. List queries never call this."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_app_config
from app.database.session import SessionLocal
from app.repositories import film_metadata_repository, streaming_repository, watchlist_repository
from app.services.provider_service import ProviderService

logger = logging.getLogger(__name__)

# Same cadence as the RSS poll. Each tick only refetches rows older than
# watch_providers.availability_max_age_hours.
AVAILABILITY_REFRESH_SECONDS = 900


def configured_country() -> str:
    return get_app_config().watch_providers.country_code or "GB"


def max_age() -> timedelta:
    hours = get_app_config().watch_providers.availability_max_age_hours
    return timedelta(hours=hours)


async def refresh_watchlist_film(
    db: Session,
    provider_service: ProviderService,
    film_id: uuid.UUID,
) -> bool:
    """Fetch flatrate ids for one watchlist film and store them.

    Films that are not on the active watchlist are left untouched.
    TMDB failures propagate so the caller can decide whether to swallow them.
    """
    if watchlist_repository.get_active_by_film_id(db, film_id) is None:
        return False
    metadata = film_metadata_repository.get_by_film_id(db, film_id)
    if metadata is None or metadata.tmdb_id is None:
        return False
    tmdb = provider_service.get_tmdb_client()
    country = configured_country()
    result = await tmdb.get_movie_watch_providers(metadata.tmdb_id, country_code=country)
    streaming_repository.upsert_flatrate(
        db,
        film_id,
        country_code=country,
        provider_ids=[entry.provider_id for entry in result.flatrate],
    )
    return True


async def refresh_stale_watchlist(provider_service: ProviderService) -> int:
    """Refresh missing or stale flatrate rows for active watchlist films."""
    country = configured_country()
    older_than = datetime.now(UTC) - max_age()
    db = SessionLocal()
    try:
        try:
            pending = streaming_repository.list_watchlist_films_to_refresh(
                db,
                country_code=country,
                older_than=older_than,
            )
        except Exception:
            logger.exception("Availability refresh could not list watchlist films")
            db.rollback()
            return 0

        refreshed = 0
        for film_id, _tmdb_id in pending:
            try:
                wrote = await refresh_watchlist_film(db, provider_service, film_id)
                db.commit()
                if wrote:
                    refreshed += 1
            except Exception:
                logger.exception("Availability refresh failed for film %s", film_id)
                db.rollback()
        return refreshed
    finally:
        db.close()


def store_flatrate_if_stale(
    db: Session,
    film_id: uuid.UUID,
    *,
    country_code: str,
    provider_ids: list[int],
) -> None:
    """On-demand write from a watch-providers response the caller already fetched."""
    if country_code != configured_country():
        return
    if not streaming_repository.is_stale(
        db,
        film_id,
        country_code=country_code,
        max_age=max_age(),
    ):
        return
    streaming_repository.upsert_flatrate(
        db,
        film_id,
        country_code=country_code,
        provider_ids=provider_ids,
    )

