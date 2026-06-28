"""Shared helpers for API integration tests."""

from __future__ import annotations

import time


def wait_for_film_status(
    client,
    film_id: str,
    status: str,
    *,
    timeout: float = 30.0,
) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        response = client.get(f"/api/v1/films/{film_id}")
        assert response.status_code == 200
        payload = response.json()
        if payload["enrichment_status"] == status:
            return payload
        time.sleep(0.2)
    raise AssertionError(f"Film {film_id} did not reach {status} within {timeout}s")
