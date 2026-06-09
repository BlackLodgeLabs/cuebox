"""OpenAI embeddings API provider."""

from __future__ import annotations

import httpx

from app.providers.embedding.base import EMBEDDING_DIMENSION, EmbeddingProvider
from app.providers.http_retry import request_with_retry

_OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"


class OpenAIEmbeddingProvider(EmbeddingProvider):
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
            _OPENAI_EMBEDDINGS_URL,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json={"model": self._model, "input": text},
        )
        response.raise_for_status()
        body = response.json()
        vector = body["data"][0]["embedding"]
        if len(vector) != EMBEDDING_DIMENSION:
            raise ValueError(
                f"OpenAI embedding dimension {len(vector)} != {EMBEDDING_DIMENSION}"
            )
        return vector
