"""Voyage AI embeddings API provider."""

from __future__ import annotations

import httpx

from app.providers.embedding.base import EMBEDDING_DIMENSION, EmbeddingProvider
from app.providers.http_retry import request_with_retry

_VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings"


class VoyageEmbeddingProvider(EmbeddingProvider):
    def __init__(
        self,
        client: httpx.AsyncClient,
        api_key: str,
        *,
        model: str,
    ) -> None:
        self._client = client
        self._api_key = api_key
        self._model = model

    async def embed(self, text: str) -> list[float]:
        response = await request_with_retry(
            self._client,
            "POST",
            _VOYAGE_EMBEDDINGS_URL,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json={"model": self._model, "input": text},
        )
        response.raise_for_status()
        body = response.json()
        vector = body["data"][0]["embedding"]
        # Voyage models commonly return 512/1024 dimensions; our schema expects 1536.
        # To maintain compatibility, pad with zeros or truncate to the configured size.
        length = len(vector)
        if length == EMBEDDING_DIMENSION:
            return vector
        if length > EMBEDDING_DIMENSION:
            return vector[:EMBEDDING_DIMENSION]
        # length < EMBEDDING_DIMENSION
        return vector + [0.0] * (EMBEDDING_DIMENSION - length)
