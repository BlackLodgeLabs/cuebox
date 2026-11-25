"""TMDB video parsing and YouTube trailer selection."""

from __future__ import annotations

import httpx
import pytest

from app.providers.tmdb import TmdbClient, TmdbVideo, select_youtube_trailer


def _video(
    *,
    key: str,
    name: str,
    site: str = "YouTube",
    video_type: str = "Trailer",
    official: bool = True,
    published_at: str | None = "2024-01-01T00:00:00.000Z",
) -> TmdbVideo:
    return TmdbVideo(
        key=key,
        name=name,
        site=site,
        video_type=video_type,
        official=official,
        published_at=published_at,
    )


def test_select_youtube_trailer_prefers_official_trailer_over_newer_teaser():
    chosen = select_youtube_trailer(
        [
            _video(
                key="teaser-new",
                name="New Teaser",
                video_type="Teaser",
                published_at="2025-06-01T00:00:00.000Z",
            ),
            _video(
                key="trailer-old",
                name="Official Trailer",
                published_at="2024-01-01T00:00:00.000Z",
            ),
            _video(
                key="vimeo",
                name="Vimeo Trailer",
                site="Vimeo",
                published_at="2026-01-01T00:00:00.000Z",
            ),
        ]
    )
    assert chosen is not None
    assert chosen.key == "trailer-old"
    assert TmdbClient.youtube_url(chosen.key) == "https://www.youtube.com/watch?v=trailer-old"


def test_select_youtube_trailer_picks_newest_official_trailer():
    chosen = select_youtube_trailer(
        [
            _video(key="old", name="Old", published_at="2020-01-01T00:00:00.000Z"),
            _video(key="new", name="New", published_at="2024-05-01T00:00:00.000Z"),
        ]
    )
    assert chosen is not None
    assert chosen.key == "new"


def test_select_youtube_trailer_falls_back_to_teaser_then_unofficial_trailer():
    teaser = select_youtube_trailer(
        [
            _video(key="teaser", name="Teaser", video_type="Teaser", official=True),
            _video(key="clip", name="Clip", video_type="Clip", official=True),
        ]
    )
    assert teaser is not None
    assert teaser.key == "teaser"

    unofficial = select_youtube_trailer(
        [
            _video(key="unofficial", name="Fan Trailer", official=False),
            _video(key="clip", name="Clip", video_type="Clip", official=True),
        ]
    )
    assert unofficial is not None
    assert unofficial.key == "unofficial"


def test_select_youtube_trailer_returns_none_without_trailer_or_teaser():
    assert select_youtube_trailer([]) is None
    assert (
        select_youtube_trailer(
            [_video(key="clip", name="Clip", video_type="Clip", site="YouTube")]
        )
        is None
    )
    assert (
        select_youtube_trailer(
            [_video(key="vimeo", name="Trailer", site="Vimeo", video_type="Trailer")]
        )
        is None
    )


@pytest.mark.asyncio
async def test_get_movie_videos_parses_tmdb_results():
    payload = {
        "id": 603,
        "results": [
            {
                "name": "Official Trailer",
                "key": "abc123",
                "site": "YouTube",
                "type": "Trailer",
                "official": True,
                "published_at": "2024-05-01T00:00:00.000Z",
            },
            {
                "name": "Broken",
                "site": "YouTube",
                "type": "Trailer",
                "official": False,
            },
        ],
    }
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    client = TmdbClient(httpx.AsyncClient(transport=transport), "test-key")

    videos = await client.get_movie_videos(603)

    assert len(videos) == 1
    assert videos[0].key == "abc123"
    assert videos[0].name == "Official Trailer"
    assert videos[0].site == "YouTube"
    assert videos[0].video_type == "Trailer"
    assert videos[0].official is True
    assert videos[0].published_at == "2024-05-01T00:00:00.000Z"
