"""Unit tests for HTTP Retry-After parsing and retry behaviour."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import httpx

from app.providers.http_retry import _parse_retry_after, request_with_retry


def test_parse_retry_after_delta_seconds():
    assert _parse_retry_after("5") == 5.0


def test_parse_retry_after_http_date():
    future = datetime.now(UTC) + timedelta(seconds=30)
    http_date = future.strftime("%a, %d %b %Y %H:%M:%S GMT")
    parsed = _parse_retry_after(http_date)
    assert parsed is not None
    assert 25 <= parsed <= 35


def test_parse_retry_after_invalid_value():
    assert _parse_retry_after("not-a-date") is None


def test_parse_retry_after_empty_value():
    assert _parse_retry_after("") is None


async def test_request_with_retry_uses_exponential_backoff_when_header_absent(monkeypatch):
    client = httpx.AsyncClient()
    responses = [
        httpx.Response(503),
        httpx.Response(503),
        httpx.Response(200, json={"ok": True}),
    ]
    request_mock = AsyncMock(side_effect=responses)
    monkeypatch.setattr(client, "request", request_mock)

    sleeps: list[float] = []

    async def fake_sleep(delay: float) -> None:
        sleeps.append(delay)

    monkeypatch.setattr("app.providers.http_retry.asyncio.sleep", fake_sleep)

    response = await request_with_retry(client, "GET", "https://example.com")
    assert response.status_code == 200
    assert sleeps == [1.0, 2.0]

    await client.aclose()


async def test_request_with_retry_honours_retry_after_header(monkeypatch):
    client = httpx.AsyncClient()
    responses = [
        httpx.Response(429, headers={"Retry-After": "7"}),
        httpx.Response(200, json={"ok": True}),
    ]
    request_mock = AsyncMock(side_effect=responses)
    monkeypatch.setattr(client, "request", request_mock)

    sleeps: list[float] = []

    async def fake_sleep(delay: float) -> None:
        sleeps.append(delay)

    monkeypatch.setattr("app.providers.http_retry.asyncio.sleep", fake_sleep)

    response = await request_with_retry(client, "GET", "https://example.com")
    assert response.status_code == 200
    assert sleeps == [7.0]

    await client.aclose()
