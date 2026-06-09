"""Semantic enrichment provider interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class SemanticEnrichmentContext:
    title: str
    year: int | None
    synopsis: str | None
    genres: list[str]
    keywords: list[str]
    director: str | None


@dataclass(frozen=True)
class SemanticProfileResult:
    subgenres: list[str]
    themes: list[str]
    tones: list[str]
    visual_descriptors: list[str]
    emotional_outcomes: list[str]
    viewing_contexts: list[str]
    complexity: float | None
    pacing: float | None
    energy: float | None
    obscurity: float | None
    semantic_summary: str | None


class SemanticEnrichmentProvider(ABC):
    @abstractmethod
    async def enrich(self, context: SemanticEnrichmentContext) -> SemanticProfileResult:
        """Generate a structured semantic profile for a film."""
