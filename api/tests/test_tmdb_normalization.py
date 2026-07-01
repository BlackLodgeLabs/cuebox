"""Unit tests for TMDB response normalization at the provider→DB boundary."""

from __future__ import annotations

import httpx
import pytest

from app.providers.tmdb import TmdbClient


def _movie_response(
    *,
    runtime: int | None = 136,
    release_date: str = "1999-03-31",
    vote_average: float | None = 8.7,
) -> dict:
    return {
        "id": 603,
        "imdb_id": "tt0133093",
        "title": "The Matrix",
        "original_title": "The Matrix",
        "release_date": release_date,
        "runtime": runtime,
        "overview": "A computer hacker learns about the true nature of reality.",
        "genres": [{"id": 1, "name": "Action"}],
        "original_language": "en",
        "production_countries": [{"iso_3166_1": "US", "name": "United States"}],
        "vote_average": vote_average,
        "poster_path": "/poster.jpg",
        "backdrop_path": "/backdrop.jpg",
    }


def _search_response(release_date: str, *, page: int = 1, total_pages: int = 1) -> dict:
    return {
        "page": page,
        "total_pages": total_pages,
        "total_results": 1,
        "results": [
            {
                "id": 603,
                "title": "The Matrix",
                "original_title": "The Matrix",
                "release_date": release_date,
                "overview": "A computer hacker learns about the true nature of reality.",
            }
        ],
    }


def _make_client(handler) -> TmdbClient:
    return TmdbClient(httpx.AsyncClient(transport=httpx.MockTransport(handler)), api_key="test-key")


@pytest.mark.asyncio
async def test_runtime_zero_maps_to_none():
    def handler(request: httpx.Request) -> httpx.Response:
        if "/credits" in str(request.url):
            return httpx.Response(200, json={"crew": []})
        return httpx.Response(200, json=_movie_response(runtime=0))

    client = _make_client(handler)
    try:
        details = await client.get_movie_details(603)
        assert details.runtime is None
    finally:
        await client._client.aclose()


@pytest.mark.asyncio
async def test_vote_average_zero_is_preserved():
    def handler(request: httpx.Request) -> httpx.Response:
        if "/credits" in str(request.url):
            return httpx.Response(200, json={"crew": []})
        return httpx.Response(200, json=_movie_response(vote_average=0.0))

    client = _make_client(handler)
    try:
        details = await client.get_movie_details(603)
        assert details.vote_average == 0.0
    finally:
        await client._client.aclose()


@pytest.mark.parametrize(
    ("release_date", "expected_year"),
    [
        ("TBD", None),
        ("199", None),
        ("", None),
        ("1999-03-31", 1999),
    ],
)
@pytest.mark.asyncio
async def test_release_date_year_parsing(release_date, expected_year):
    def handler(request: httpx.Request) -> httpx.Response:
        if "/search/" in str(request.url):
            return httpx.Response(200, json=_search_response(release_date))
        if "/credits" in str(request.url):
            return httpx.Response(200, json={"crew": []})
        return httpx.Response(200, json=_movie_response(release_date=release_date))

    client = _make_client(handler)
    try:
        search_page = await client.search_movie("The Matrix")
        assert search_page.results[0].year == expected_year

        details = await client.get_movie_details(603)
        assert details.year == expected_year
    finally:
        await client._client.aclose()
