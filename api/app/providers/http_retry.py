"""HTTP retry helper for external provider clients."""

import asyncio
from typing import Any

import httpx

_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 3


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
            delay = float(retry_after) if retry_after else 2**attempt
            await asyncio.sleep(delay)
    assert last_response is not None
    return last_response
