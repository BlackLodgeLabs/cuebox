"""RSS sync event ledger data-access helpers."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.enums import RssEventType
from app.database.models import RssSyncEvent


def event_exists(db: Session, event_id: uuid.UUID) -> bool:
    return db.get(RssSyncEvent, event_id) is not None


def create_event(
    db: Session,
    *,
    event_id: uuid.UUID,
    event_type: RssEventType,
    event_timestamp: datetime,
    letterboxd_uri: str | None,
    payload: dict,
) -> RssSyncEvent:
    event = RssSyncEvent(
        id=event_id,
        event_type=event_type,
        event_timestamp=event_timestamp,
        letterboxd_uri=letterboxd_uri,
        payload=payload,
        processed=False,
    )
    db.add(event)
    db.flush()
    return event


def mark_processed(db: Session, event: RssSyncEvent) -> RssSyncEvent:
    event.processed = True
    event.processed_at = datetime.now(UTC)
    db.flush()
    return event


def list_unprocessed(db: Session) -> list[RssSyncEvent]:
    stmt = (
        select(RssSyncEvent)
        .where(RssSyncEvent.processed.is_(False))
        .order_by(RssSyncEvent.event_timestamp)
    )
    return list(db.scalars(stmt).all())


def has_watched_event_for_uri(db: Session, letterboxd_uri: str) -> bool:
    stmt = select(RssSyncEvent.id).where(
        RssSyncEvent.event_type == RssEventType.WATCHED,
        RssSyncEvent.letterboxd_uri == letterboxd_uri,
    )
    return db.scalars(stmt).first() is not None
