"""OMDb API client."""

from __future__ import annotations

import re

import httpx

from app.providers.http_retry import request_with_retry

OMDB_BASE_URL = "http://www.omdbapi.com/"


class OmdbClient:
    def __init__(self, client: httpx.AsyncClient, api_key: str) -> None:
        self._client = client
        self._api_key = api_key

    async def get_rotten_tomatoes_score(self, imdb_id: str) -> int | None:
        response = await request_with_retry(
            self._client,
            "GET",
            OMDB_BASE_URL,
            params={"apikey": self._api_key, "i": imdb_id, "tomatoes": "true"},
        )
        response.raise_for_status()
        data = response.json()
        if data.get("Response") == "False":
            return None
        for rating in data.get("Ratings", []):
            if rating.get("Source") == "Rotten Tomatoes":
                value = rating.get("Value", "")
                match = re.search(r"(\d+)%", value)
                if match:
                    return int(match.group(1))
        return None
