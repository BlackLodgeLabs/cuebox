"""HTTP retry helper for external provider clients."""

import asyncio
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any

import httpx

_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 3


def _parse_retry_after(value: str) -> float | None:
    """Return delay seconds from a Retry-After header value.

    Supports either a delta-seconds number or an HTTP-date per RFC 7231.
    """
    if not value:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        try:
            date_value = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None
        if date_value is None:
            return None
        # Ensure timezone-aware in UTC for subtraction
        if date_value.tzinfo is None:
            date_value = date_value.replace(tzinfo=UTC)
        now = datetime.now(UTC)
        seconds = (date_value - now).total_seconds()
        # Negative delays are treated as immediate retry
        return max(0.0, seconds)


async def request_with_retry(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    **kwargs: Any,
) -> httpx.Response:
    last_response: httpx.Response | None = None
    for attempt in range(_MAX_ATTEMPTS):
        response = await client.request(method, url, **kwargs)
        last_response = response
        if response.status_code not in _RETRYABLE_STATUS:
            return response
        if attempt < _MAX_ATTEMPTS - 1:
            retry_after = response.headers.get("Retry-After")
            parsed_delay = _parse_retry_after(retry_after) if retry_after else None
            delay = parsed_delay if parsed_delay is not None else 2**attempt
            await asyncio.sleep(delay)
    assert last_response is not None
    return last_response
