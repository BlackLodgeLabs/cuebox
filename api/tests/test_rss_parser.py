"""Unit tests for Letterboxd RSS parser."""

from app.database.enums import RssEventType
from app.services.rss_parser import (
    diff_watchlist_events,
    event_fingerprint,
    parse_diary_feed,
    parse_watchlist_feed,
)

WATCHLIST_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>The Wicker Man</title>
      <link>https://letterboxd.com/film/the-wicker-man/</link>
      <pubDate>Fri, 01 Nov 2024 12:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>
"""

DIARY_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:letterboxd="https://letterboxd.com">
  <channel>
    <item>
      <title>Stalker, 1979 — ★★★★★</title>
      <link>https://letterboxd.com/film/stalker/</link>
      <pubDate>Sat, 02 Nov 2024 12:00:00 +0000</pubDate>
      <letterboxd:filmTitle>Stalker</letterboxd:filmTitle>
      <letterboxd:filmYear>1979</letterboxd:filmYear>
    </item>
  </channel>
</rss>
"""


def test_parse_watchlist_feed():
    events = parse_watchlist_feed(WATCHLIST_XML)
    assert len(events) == 1
    assert events[0].event_type == RssEventType.WATCHLIST_ADD
    assert events[0].letterboxd_uri == "https://letterboxd.com/film/the-wicker-man/"


def test_parse_diary_feed():
    events = parse_diary_feed(DIARY_XML)
    assert len(events) == 1
    assert events[0].event_type == RssEventType.WATCHED
    assert events[0].letterboxd_uri == "https://letterboxd.com/film/stalker/"
    assert events[0].payload["year"] == 1979


def test_event_fingerprint_is_stable():
    from datetime import UTC, datetime

    ts = datetime(2024, 11, 1, tzinfo=UTC)
    first = event_fingerprint(RssEventType.WATCHED, "https://letterboxd.com/film/a/", ts)
    second = event_fingerprint(RssEventType.WATCHED, "https://letterboxd.com/film/a/", ts)
    assert first == second


def test_diff_watchlist_events_add_and_remove():
    events = diff_watchlist_events(
        {"https://letterboxd.com/film/new/"},
        {"https://letterboxd.com/film/old/"},
        watched_uris=set(),
    )
    types = {event.event_type for event in events}
    assert RssEventType.WATCHLIST_ADD in types
    assert RssEventType.WATCHLIST_REMOVE in types
