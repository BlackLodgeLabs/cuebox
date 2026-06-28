"""Developer Mode observability aggregation."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_app_config
from app.core.exceptions import not_found
from app.database.models import Film, RecommendationSession, SystemVersion
from app.repositories import film_repository, recommendation_session_repository
from app.schemas.developer import (
    DevAIDetailResponse,
    DevEmbeddingDetail,
    DevFilmMatchResponse,
    DevProfileTrace,
    DevRankingDetail,
    DevRetrievalCandidate,
    DevRetrievalTraceResponse,
    DevScoringCandidate,
    DevScoringDetailResponse,
    DevSemanticEnrichmentDetail,
    DevSystemVersionEntry,
    DevSystemVersionsResponse,
)


def _as_float(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return float(value)


class DeveloperService:
    def get_retrieval_trace(
        self,
        db: Session,
        session_id: uuid.UUID,
    ) -> DevRetrievalTraceResponse:
        session = self._get_session_or_404(db, session_id)
        config = get_app_config()
        profile = session.profile
        film_titles = self._film_title_map(
            db, [candidate.film_id for candidate in session.candidates]
        )
        candidates = [
            DevRetrievalCandidate(
                film_id=candidate.film_id,
                title=film_titles.get(candidate.film_id, "Unknown"),
                retrieval_rank=candidate.retrieval_rank,
                similarity_score=_as_float(candidate.similarity_score),
            )
            for candidate in sorted(
                session.candidates,
                key=lambda row: row.retrieval_rank if row.retrieval_rank is not None else 9999,
            )
        ]
        return DevRetrievalTraceResponse(
            session_id=session.id,
            profile=DevProfileTrace(
                profile_id=profile.id,
                profile_hash=profile.profile_hash,
                structured_profile=profile.structured_profile,
                narrative_profile=profile.narrative_profile,
                embedding_model=profile.embedding_model,
                embedding_version=profile.embedding_version,
                profile_cache_hit=session.profile_cache_hit,
            ),
            candidates=candidates,
            retrieval_candidate_limit=config.recommendation.retrieval_candidate_limit,
            candidates_returned=len(candidates),
        )

    def get_scoring_detail(
        self,
        db: Session,
        session_id: uuid.UUID,
    ) -> DevScoringDetailResponse:
        session = self._get_session_or_404(db, session_id)
        config = get_app_config()
        film_titles = self._film_title_map(
            db, [candidate.film_id for candidate in session.candidates]
        )
        candidates = [
            DevScoringCandidate(
                film_id=candidate.film_id,
                title=film_titles.get(candidate.film_id, "Unknown"),
                raw_score=_as_float(candidate.raw_score),
                final_score=_as_float(candidate.final_score),
                llm_rank=candidate.llm_rank,
                score_breakdown={
                    key: float(value)
                    for key, value in (candidate.score_breakdown or {}).items()
                },
            )
            for candidate in session.candidates
        ]
        scoring = config.scoring
        return DevScoringDetailResponse(
            session_id=session.id,
            scoring_version=session.scoring_version,
            weight_set=session.weight_set,
            weights={
                "theme_fit": scoring.theme_fit,
                "emotional_fit": scoring.emotional_fit,
                "visual_tonal_fit": scoring.visual_tonal_fit,
                "pacing_fit": scoring.pacing_fit,
                "complexity_fit": scoring.complexity_fit,
                "era_fit": scoring.era_fit,
                "obscurity_fit": scoring.obscurity_fit,
                "viewing_context_fit": scoring.viewing_context_fit,
                "diversity_adjustment": scoring.diversity_adjustment,
            },
            candidates=candidates,
        )

    def get_ai_detail(
        self,
        db: Session,
        session_id: uuid.UUID,
    ) -> DevAIDetailResponse:
        session = self._get_session_or_404(db, session_id)
        config = get_app_config()
        return DevAIDetailResponse(
            session_id=session.id,
            semantic_enrichment=DevSemanticEnrichmentDetail(
                provider=config.providers.semantic_enrichment.provider,
                model=config.providers.semantic_enrichment.model,
                semantic_version=session.semantic_version,
            ),
            embedding=DevEmbeddingDetail(
                provider=config.providers.embedding.provider,
                model=config.providers.embedding.model,
                embedding_version=session.embedding_version,
            ),
            ranking=DevRankingDetail(
                provider=session.ranking_provider or config.providers.ranking.provider,
                model=session.ranking_model or config.providers.ranking.model,
                prompt_version=session.prompt_version,
                tokens_input=session.tokens_input,
                tokens_output=session.tokens_output,
            ),
        )

    def get_film_match(
        self,
        db: Session,
        film_id: uuid.UUID,
    ) -> DevFilmMatchResponse:
        film = film_repository.get_by_id_with_relations(db, film_id)
        if film is None:
            raise not_found("Film")
        metadata = film.metadata_
        return DevFilmMatchResponse(
            film_id=film.id,
            tmdb_id=metadata.tmdb_id if metadata else None,
            imdb_id=metadata.imdb_id if metadata else None,
            match_confidence=_as_float(metadata.match_confidence) if metadata else None,
            metadata_source=metadata.metadata_source if metadata else None,
            enrichment_status=film.enrichment_status.value,
        )

    def get_system_versions(self, db: Session) -> DevSystemVersionsResponse:
        stmt = (
            select(SystemVersion)
            .where(SystemVersion.active.is_(True))
            .order_by(SystemVersion.artifact_type, SystemVersion.artifact_name)
        )
        rows = list(db.scalars(stmt).all())
        return DevSystemVersionsResponse(
            versions=[
                DevSystemVersionEntry(
                    artifact_type=row.artifact_type.value,
                    artifact_name=row.artifact_name,
                    version=row.version,
                    active=row.active,
                    created_at=row.created_at,
                )
                for row in rows
            ]
        )

    def _get_session_or_404(
        self,
        db: Session,
        session_id: uuid.UUID,
    ) -> RecommendationSession:
        session = recommendation_session_repository.get_by_id(db, session_id)
        if session is None:
            raise not_found("Recommendation session")
        return session

    def _film_title_map(
        self,
        db: Session,
        film_ids: list[uuid.UUID],
    ) -> dict[uuid.UUID, str]:
        if not film_ids:
            return {}
        stmt = select(Film.id, Film.title).where(Film.id.in_(film_ids))
        return {row.id: row.title for row in db.execute(stmt).all()}
