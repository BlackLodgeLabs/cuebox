"""Ranking provider interface."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RankingCandidateInput:
    film_id: uuid.UUID
    title: str
    year: int | None
    runtime: int | None
    director: str | None
    genres: list[str]
    semantic_summary: str | None
    raw_score: float
    final_score: float
    score_breakdown: dict[str, float]


@dataclass
class RankingExplanation:
    why_it_matches: str
    most_influential_factors: list[str]
    why_it_matches_short: str | None = None
    why_it_beat_alternatives: str | None = None
    caveats: str | None = None


@dataclass
class RankingResult:
    winner_film_id: uuid.UUID
    runners_up_film_ids: list[uuid.UUID]
    explanations: dict[str, RankingExplanation] = field(default_factory=dict)
    tokens_input: int | None = None
    tokens_output: int | None = None


class RankingProvider(ABC):
    @abstractmethod
    async def rank(
        self,
        *,
        profile_narrative: str,
        structured_profile: dict[str, Any],
        candidates: list[RankingCandidateInput],
    ) -> RankingResult:
        """Return winner, up to four runners-up, and structured explanations."""
