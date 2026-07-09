"""Unit tests for Letterboxd TMDB redirect resolver."""

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services.letterboxd_resolver import clear_resolve_cache, resolve_letterboxd_uri


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_resolve_cache()
    yield
    clear_resolve_cache()


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
