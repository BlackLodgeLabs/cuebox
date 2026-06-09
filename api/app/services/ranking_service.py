"""LLM ranking for recommendation Stage 6."""

from __future__ import annotations

from app.providers.ranking.base import RankingCandidateInput, RankingProvider, RankingResult
from app.services.diversity_service import DiversityAdjustedCandidate


class RankingService:
    def __init__(self, provider: RankingProvider) -> None:
        self._provider = provider

    async def rank(
        self,
        *,
        profile_narrative: str,
        structured_profile: dict,
        candidates: list[DiversityAdjustedCandidate],
        max_candidates: int = 20,
    ) -> RankingResult:
        top = candidates[:max_candidates]
        inputs = [
            RankingCandidateInput(
                film_id=item.film_id,
                title=item.film.title,
                year=item.film.year,
                runtime=item.film.metadata_.runtime if item.film.metadata_ else None,
                director=item.film.metadata_.director if item.film.metadata_ else None,
                genres=list(item.film.metadata_.genres or []) if item.film.metadata_ else [],
                semantic_summary=(
                    item.film.semantic_profile.semantic_summary
                    if item.film.semantic_profile
                    else None
                ),
                raw_score=item.raw_score,
                final_score=item.final_score,
                score_breakdown=item.score_breakdown,
            )
            for item in top
        ]
        return await self._provider.rank(
            profile_narrative=profile_narrative,
            structured_profile=structured_profile,
            candidates=inputs,
        )
