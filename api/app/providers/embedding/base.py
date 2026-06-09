"""Embedding provider interface."""

from __future__ import annotations

from abc import ABC, abstractmethod

EMBEDDING_DIMENSION = 1536


class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        """Return a dense embedding vector for the given text."""
