"""Unit tests for Letterboxd TMDB redirect resolver."""

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services.letterboxd_resolver import (
    clear_resolve_cache,
    resolve_letterboxd_uri,
    slug_candidates,
    slugify_title,
)


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_resolve_cache()
    yield
    clear_resolve_cache()


def test_slugify_title():
    assert slugify_title("Fight Club") == "fight-club"
    assert slugify_title("The Matrix") == "the-matrix"


def test_slug_candidates_includes_year_variant():
    assert slug_candidates("Fight Club", year=1999) == ["fight-club", "fight-club-1999"]


@pytest.mark.asyncio
async def test_resolve_letterboxd_uri_follows_redirect_to_film_page():
    final_url = "https://letterboxd.com/film/the-matrix/"
    request = httpx.Request("GET", final_url)
    response = httpx.Response(200, request=request)

    client = AsyncMock()
    client.get = AsyncMock(return_value=response)

    uri = await resolve_letterboxd_uri(603, client=client)
    assert uri == "https://letterboxd.com/film/the-matrix/"


@pytest.mark.asyncio
async def test_resolve_letterboxd_uri_rejects_member_page():
    final_url = "https://letterboxd.com/member/testuser/"
    request = httpx.Request("GET", final_url)
    response = httpx.Response(200, request=request)

    client = AsyncMock()
    client.get = AsyncMock(return_value=response)

    assert await resolve_letterboxd_uri(603, client=client) is None


@pytest.mark.asyncio
async def test_resolve_letterboxd_uri_falls_back_to_slug_probe():
    redirect_request = httpx.Request("GET", "https://letterboxd.com/tmdb/550")
    redirect_response = httpx.Response(403, request=redirect_request)

    film_request = httpx.Request("GET", "https://letterboxd.com/film/fight-club/")
    film_response = httpx.Response(
        200,
        request=film_request,
        text='<body data-tmdb-id="550">',
    )

    client = AsyncMock()

    async def fake_get(url: str, *args, **kwargs):
        if "/tmdb/550" in url:
            return redirect_response
        if url.endswith("/film/fight-club/"):
            return film_response
        return httpx.Response(404, request=httpx.Request("GET", url))

    client.get = AsyncMock(side_effect=fake_get)

    uri = await resolve_letterboxd_uri(
        550,
        title="Fight Club",
        year=1999,
        client=client,
    )
    assert uri == "https://letterboxd.com/film/fight-club/"


@pytest.mark.asyncio
async def test_resolve_letterboxd_uri_returns_none_on_http_error():
    client = AsyncMock()
    client.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))

    assert await resolve_letterboxd_uri(603, client=client) is None


@pytest.mark.asyncio
async def test_resolve_letterboxd_uri_uses_cache():
    with patch(
        "app.services.letterboxd_resolver._resolve_cache",
        {603: "https://letterboxd.com/film/the-matrix/"},
    ):
        client = AsyncMock()
        uri = await resolve_letterboxd_uri(603, client=client)
        assert uri == "https://letterboxd.com/film/the-matrix/"
        client.get.assert_not_called()
