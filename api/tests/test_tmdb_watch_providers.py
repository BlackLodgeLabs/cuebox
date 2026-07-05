"""Unit tests for TMDB watch provider client parsing."""

from __future__ import annotations

import httpx
import pytest

from app.providers.tmdb import TmdbClient
from tests.mock_providers import (
    EMPTY_GB_TMDB_ID,
    MATRIX_TMDB_ID,
    mock_provider_handler,
)


@pytest.fixture
def tmdb_client() -> TmdbClient:
    transport = httpx.MockTransport(lambda request: mock_provider_handler(request))
    return TmdbClient(httpx.AsyncClient(transport=transport), "test-key")


@pytest.mark.asyncio
async def test_get_movie_watch_providers_parses_gb_categories(tmdb_client: TmdbClient):
    result = await tmdb_client.get_movie_watch_providers(MATRIX_TMDB_ID, country_code="GB")

    assert result.link == f"https://www.themoviedb.org/movie/{MATRIX_TMDB_ID}/watch?locale=GB"
    assert len(result.flatrate) == 2
    assert result.flatrate[0].provider_name == "Netflix"
    assert len(result.rent) == 1
    assert len(result.buy) == 1
    assert len(result.ads) == 1


@pytest.mark.asyncio
async def test_get_movie_watch_providers_handles_empty_gb(tmdb_client: TmdbClient):
    result = await tmdb_client.get_movie_watch_providers(EMPTY_GB_TMDB_ID, country_code="GB")

    assert result.flatrate == []
    assert result.rent == []
    assert result.buy == []
    assert result.ads == []


@pytest.mark.asyncio
async def test_get_movie_watch_providers_omits_missing_arrays(tmdb_client: TmdbClient):
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json={
                "id": 1,
                "results": {
                    "GB": {
                        "link": "https://www.themoviedb.org/movie/1/watch?locale=GB",
                        "flatrate": [
                            {
                                "provider_id": 8,
                                "provider_name": "Netflix",
                                "logo_path": "/netflix.jpg",
                                "display_priority": 1,
                            }
                        ],
                    }
                },
            },
        )
    )
    client = TmdbClient(httpx.AsyncClient(transport=transport), "test-key")
    result = await client.get_movie_watch_providers(1, country_code="GB")

    assert len(result.flatrate) == 1
    assert result.rent == []
    assert result.buy == []
    assert result.ads == []


def test_provider_logo_url_builds_image_tmdb_url():
    url = TmdbClient.provider_logo_url("/foo.jpg", size="w92")
    assert url == "https://image.tmdb.org/t/p/w92/foo.jpg"


def test_provider_logo_url_returns_none_for_missing_path():
    assert TmdbClient.provider_logo_url(None) is None
