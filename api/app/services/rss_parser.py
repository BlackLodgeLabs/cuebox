"""Letterboxd RSS feed parsing for watchlist sync."""

from __future__ import annotations

import hashlib
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree

import httpx

from app.database.enums import RssEventType

logger = logging.getLogger(__name__)

# Letterboxd exposes a single public activity feed at /rss/ (diary / watched films).
# /watchlist/rss/ returns 403 and is not a supported endpoint.
DIARY_FEED_URL = "https://letterboxd.com/{username}/rss/"

_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "letterboxd": "https://letterboxd.com",
}


@dataclass(frozen=True)
class RssEvent:
    event_id: uuid.UUID
    event_type: RssEventType
    event_timestamp: datetime
    letterboxd_uri: str | None
    payload: dict


def event_fingerprint(
    event_type: RssEventType,
    letterboxd_uri: str | None,
    event_timestamp: datetime,
) -> uuid.UUID:
    key = f"{event_type.value}:{letterboxd_uri or ''}:{event_timestamp.isoformat()}"
    digest = hashlib.sha256(key.encode()).hexdigest()
    return uuid.UUID(digest[:32])


def parse_watchlist_feed(xml_text: str) -> list[RssEvent]:
    """Parse watchlist RSS entries as watchlist_add events."""
    events: list[RssEvent] = []
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError as exc:
        logger.warning("Failed to parse watchlist RSS: %s", exc)
        return events

    for item in root.findall(".//item"):
        try:
            link_el = item.find("link")
            title_el = item.find("title")
            pub_el = item.find("pubDate")
            if link_el is None or not (link_el.text or "").strip():
                continue
            uri = link_el.text.strip()
            if "/film/" not in uri:
                continue
            timestamp = _parse_pub_date(pub_el.text if pub_el is not None else None)
            event_type = RssEventType.WATCHLIST_ADD
            event_id = event_fingerprint(event_type, uri, timestamp)
            events.append(
                RssEvent(
                    event_id=event_id,
                    event_type=event_type,
                    event_timestamp=timestamp,
                    letterboxd_uri=uri,
                    payload={
                        "title": title_el.text.strip() if title_el is not None and title_el.text else None,
                        "source": "watchlist_feed",
                    },
                )
            )
        except Exception:
            logger.exception("Skipping malformed watchlist RSS item")
    return events


def parse_diary_feed(xml_text: str) -> list[RssEvent]:
    """Parse diary RSS entries as watched events."""
    events: list[RssEvent] = []
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError as exc:
        logger.warning("Failed to parse diary RSS: %s", exc)
        return events

    for item in root.findall(".//item"):
        try:
            link_el = item.find("link")
            title_el = item.find("title")
            pub_el = item.find("pubDate")
            film_title_el = item.find("letterboxd:filmTitle", _NS)
            film_year_el = item.find("letterboxd:filmYear", _NS)
            if link_el is None or not (link_el.text or "").strip():
                continue
            uri = link_el.text.strip()
            if "/film/" not in uri:
                continue
            timestamp = _parse_pub_date(pub_el.text if pub_el is not None else None)
            event_type = RssEventType.WATCHED
            event_id = event_fingerprint(event_type, uri, timestamp)
            events.append(
                RssEvent(
                    event_id=event_id,
                    event_type=event_type,
                    event_timestamp=timestamp,
                    letterboxd_uri=uri,
                    payload={
                        "title": (
                            film_title_el.text.strip()
                            if film_title_el is not None and film_title_el.text
                            else (title_el.text.strip() if title_el is not None and title_el.text else None)
                        ),
                        "year": int(film_year_el.text) if film_year_el is not None and film_year_el.text else None,
                        "source": "diary_feed",
                    },
                )
            )
        except Exception:
            logger.exception("Skipping malformed diary RSS item")
    return events


def diff_watchlist_events(
    feed_uris: set[str],
    active_uris: set[str],
    *,
    watched_uris: set[str],
) -> list[RssEvent]:
    """Derive add/remove events from watchlist feed snapshot vs active watchlist."""
    events: list[RssEvent] = []
    now = datetime.now(UTC)

    for uri in sorted(feed_uris - active_uris):
        event_type = RssEventType.WATCHLIST_ADD
        event_id = event_fingerprint(event_type, uri, now)
        events.append(
            RssEvent(
                event_id=event_id,
                event_type=event_type,
                event_timestamp=now,
                letterboxd_uri=uri,
                payload={"source": "watchlist_diff"},
            )
        )

    for uri in sorted(active_uris - feed_uris):
        if uri in watched_uris:
            continue
        event_type = RssEventType.WATCHLIST_REMOVE
        event_id = event_fingerprint(event_type, uri, now)
        events.append(
            RssEvent(
                event_id=event_id,
                event_type=event_type,
                event_timestamp=now,
                letterboxd_uri=uri,
                payload={"source": "watchlist_diff"},
            )
        )
    return events


async def fetch_feed(client: httpx.AsyncClient, url: str) -> str:
    response = await client.get(url, follow_redirects=True)
    response.raise_for_status()
    return response.text


def _parse_pub_date(value: str | None) -> datetime:
    if not value:
        return datetime.now(UTC)
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)
    except (TypeError, ValueError, OverflowError):
        return datetime.now(UTC)
