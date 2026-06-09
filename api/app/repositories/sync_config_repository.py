"""Sync configuration data-access helpers."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import SyncConfig

POLLING_INTERVAL_SECONDS = 900


def get_config(db: Session) -> SyncConfig | None:
    stmt = select(SyncConfig).order_by(SyncConfig.created_at).limit(1)
    return db.scalars(stmt).first()


def get_or_create_config(db: Session) -> SyncConfig:
    config = get_config(db)
    if config is not None:
        return config
    config = SyncConfig()
    db.add(config)
    db.flush()
    return config


def upsert_rss_username(db: Session, username: str) -> SyncConfig:
    config = get_or_create_config(db)
    config.rss_username = username
    config.configured_at = datetime.now(UTC)
    db.flush()
    return config


def update_poll_status(
    db: Session,
    *,
    status: str,
    events_processed: int,
) -> SyncConfig:
    config = get_or_create_config(db)
    config.last_polled_at = datetime.now(UTC)
    config.last_poll_status = status
    config.events_processed_last_poll = events_processed
    db.flush()
    return config
