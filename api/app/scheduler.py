"""APScheduler setup for RSS polling."""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.repositories import sync_config_repository
from app.services.provider_service import ProviderService
from app.services.streaming_availability_service import (
    AVAILABILITY_REFRESH_SECONDS,
    refresh_stale_watchlist,
)
from app.services.sync_service import SyncService

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _availability_refresh_job(provider_service: ProviderService) -> None:
    try:
        count = await refresh_stale_watchlist(provider_service)
        logger.info("Availability refresh completed; films updated: %s", count)
    except Exception:
        logger.exception("Availability refresh job failed")


async def _rss_poll_job(provider_service: ProviderService) -> None:
    sync = SyncService(provider_service)
    try:
        count = await sync.poll_rss()
        logger.info("RSS poll completed; events processed: %s", count)
    except Exception:
        logger.exception("RSS poll job failed")


def start_scheduler(provider_service: ProviderService) -> AsyncIOScheduler | None:
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _rss_poll_job,
        "interval",
        seconds=sync_config_repository.POLLING_INTERVAL_SECONDS,
        args=[provider_service],
        max_instances=1,
        id="rss_poll",
        replace_existing=True,
    )
    scheduler.add_job(
        _availability_refresh_job,
        "interval",
        seconds=AVAILABILITY_REFRESH_SECONDS,
        args=[provider_service],
        max_instances=1,
        id="availability_refresh",
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info("RSS scheduler started (interval=%ss)", sync_config_repository.POLLING_INTERVAL_SECONDS)
    return scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("RSS scheduler stopped")
