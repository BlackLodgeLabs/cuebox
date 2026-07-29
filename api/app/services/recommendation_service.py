"""Six-stage recommendation pipeline orchestration."""

from __future__ import annotations

import random
import uuid
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_app_config
from app.core.exceptions import AppError
from app.database.enums import ArtifactType, EmbeddingType
from app.repositories import (
    film_repository,
    recommendation_candidate_repository,
    recommendation_exposure_repository,
    recommendation_result_repository,
    recommendation_session_repository,
    system_version_repository,
)
from app.schemas.errors import ErrorCode
from app.schemas.recommendations import (
    CreateRecommendationRequest,
    CreateRecommendationResponse,
    Explanation,
    FilmResult,
    ProfileSummary,
    RecommendationHistoryItem,
    RecommendationHistoryListResponse,
    RecommendationSessionDetail,
)
from app.services.diversity_service import apply_diversity
from app.services.ranking_service import RankingService
from app.services.recommendation_profile_service import RecommendationProfileService
from app.services.scoring_service import runtime_ceiling, score_candidates
from app.services.provider_service import ProviderService

MIN_CANDIDATES = 5
STOCHASTIC_BAND = 0.08


@dataclass
class PipelineCandidate:
    film_id: uuid.UUID
    film: Any
    retrieval_rank: int | None
    similarity_score: float | None
    raw_score: float
    final_score: float
    score_breakdown: dict[str, float]
    llm_rank: int | None = None


class RecommendationService:
    def __init__(self, provider_service: ProviderService) -> None:
        self._providers = provider_service
        self._profile_service = RecommendationProfileService(provider_service)

    async def create_recommendation(
        self,
        db: Session,
        request: CreateRecommendationRequest,
    ) -> CreateRecommendationResponse:
        questionnaire = request.questionnaire.model_dump()
        profile = await self._profile_service.resolve_profile(
            db, questionnaire, request.notes
        )

        candidates, relaxation = self._stage1_filter(db, questionnaire)
        if not candidates:
            raise AppError(
                code=ErrorCode.INSUFFICIENT_CANDIDATES,
                message="No ready films survive hard constraint filtering.",
                status_code=422,
            )

        retrieved = self._stage2_retrieve(db, candidates, profile.embedding)
        scored = score_candidates(
            [item.film for item in retrieved],
            profile.structured_profile,
            get_app_config().scoring,
        )
        exposure_map = recommendation_exposure_repository.get_map(
            db, [item.film.id for item in scored]
        )
        diversified = apply_diversity(scored, exposure_map, get_app_config().scoring)
        shortlist = self._stage5_stochastic(diversified)

        ranking = RankingService(self._providers.get_ranking_provider())
        ranking_result = await ranking.rank(
            profile_narrative=profile.narrative_profile,
            structured_profile=profile.structured_profile,
            candidates=shortlist,
        )

        pipeline_candidates = self._merge_ranking(
            retrieved, diversified, ranking_result, shortlist
        )
        versions = self._active_versions(db)
        config = get_app_config()

        session = recommendation_session_repository.create(
            db,
            profile_id=profile.profile_id,
            winner_film_id=ranking_result.winner_film_id,
            ranking_provider=config.providers.ranking.provider,
            ranking_model=config.providers.ranking.model,
            semantic_version=versions.get("semantic"),
            embedding_version=versions.get("embedding"),
            scoring_version=versions.get("scoring"),
            weight_set="default",
            prompt_version=versions.get("prompt"),
            constraint_relaxation=relaxation or None,
            tokens_input=ranking_result.tokens_input,
            tokens_output=ranking_result.tokens_output,
            profile_cache_hit=profile.profile_cache_hit,
        )

        recommendation_candidate_repository.create_many(
            db,
            session_id=session.id,
            candidates=[
                {
                    "film_id": item.film_id,
                    "retrieval_rank": item.retrieval_rank,
                    "similarity_score": item.similarity_score,
                    "raw_score": item.raw_score,
                    "final_score": item.final_score,
                    "llm_rank": item.llm_rank,
                    "score_breakdown": item.score_breakdown,
                }
                for item in pipeline_candidates
            ],
        )

        winner_key = str(ranking_result.winner_film_id)
        winner_expl = ranking_result.explanations.get(winner_key)
        winner_payload = _explanation_to_payload(winner_expl) if winner_expl else None
        runner_payload: dict[str, Any] = {}
        for film_id in ranking_result.runners_up_film_ids:
            expl = ranking_result.explanations.get(str(film_id))
            if expl is None:
                continue
            runner_payload[str(film_id)] = _explanation_to_payload(expl)
        recommendation_result_repository.create(
            db,
            session_id=session.id,
            winner_explanation=(
                winner_payload["why_it_matches"] if winner_payload else None
            ),
            winner_explanation_detail=winner_payload,
            runner_up_explanations=runner_payload,
        )

        for item in pipeline_candidates:
            recommendation_exposure_repository.increment_exposure(
                db,
                film_id=item.film_id,
                is_winner=item.film_id == ranking_result.winner_film_id,
            )

        db.commit()
        db.refresh(session)

        recommended_ids = [ranking_result.winner_film_id, *ranking_result.runners_up_film_ids]
        films_map = {
            film.id: film
            for film in film_repository.get_many_by_ids_with_relations(db, recommended_ids)
        }
        winner_film = films_map.get(ranking_result.winner_film_id)
        runners_up_films = [
            films_map[film_id]
            for film_id in ranking_result.runners_up_film_ids
            if film_id in films_map
        ]

        return CreateRecommendationResponse(
            session_id=session.id,
            profile_id=profile.profile_id,
            profile_cache_hit=profile.profile_cache_hit,
            winner=_film_result(
                winner_film,
                ranking_result.explanations.get(winner_key),
                is_winner=True,
            ),
            runners_up=[
                _film_result(
                    film,
                    ranking_result.explanations.get(str(film_id)),
                    is_winner=False,
                )
                for film_id, film in zip(
                    ranking_result.runners_up_film_ids, runners_up_films, strict=False
                )
                if film is not None
            ],
            constraint_relaxation=relaxation,
            created_at=session.created_at,
        )

    def get_session(self, db: Session, session_id: uuid.UUID) -> RecommendationSessionDetail:
        session = recommendation_session_repository.get_by_id(db, session_id)
        if session is None:
            from app.core.exceptions import not_found

            raise not_found("Recommendation session")

        result = session.result
        runner_ids: list[uuid.UUID] = []
        runner_explanations = {}
        if result and result.runner_up_explanations:
            runner_ids = [uuid.UUID(fid) for fid in list(result.runner_up_explanations.keys())[:4]]
            runner_explanations = result.runner_up_explanations

        all_ids = (
            [session.winner_film_id, *runner_ids]
            if session.winner_film_id
            else runner_ids
        )
        films_map = {
            film.id: film
            for film in film_repository.get_many_by_ids_with_relations(db, all_ids)
        }
        winner = films_map.get(session.winner_film_id) if session.winner_film_id else None

        runners_up = []
        for film_id in runner_ids:
            film = films_map.get(film_id)
            if film is None:
                continue
            payload = runner_explanations.get(str(film_id), {})
            runners_up.append(
                _film_result(
                    film,
                    _explanation_from_payload(payload),
                    is_winner=False,
                )
            )

        winner_payload: dict[str, Any] = {}
        if result:
            if result.winner_explanation_detail:
                winner_payload = result.winner_explanation_detail
            elif result.winner_explanation:
                winner_payload = {
                    "why_it_matches": result.winner_explanation,
                    "most_influential_factors": [],
                }

        winner_result = (
            _film_result(
                winner,
                _explanation_from_payload(winner_payload),
                is_winner=True,
            )
            if winner is not None
            else FilmResult(
                film_id=session.winner_film_id or uuid.UUID(int=0),
                title="Unknown",
                explanation=_explanation_from_payload(winner_payload),
            )
        )

        return RecommendationSessionDetail(
            session_id=session.id,
            profile_id=session.profile_id,
            profile_cache_hit=session.profile_cache_hit,
            winner=winner_result,
            runners_up=runners_up,
            constraint_relaxation=session.constraint_relaxation,
            created_at=session.created_at,
            profile_summary=ProfileSummary(
                narrative_profile=session.profile.narrative_profile,
                structured_profile=session.profile.structured_profile,
            ),
        )

    def list_history(
        self,
        db: Session,
        *,
        search: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        watch_status: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> RecommendationHistoryListResponse:
        sessions, total = recommendation_session_repository.list_history(
            db,
            search=search,
            date_from=date_from,
            date_to=date_to,
            watch_status=watch_status,
            limit=limit,
            offset=offset,
        )
        items: list[RecommendationHistoryItem] = []
        for session in sessions:
            winner = film_repository.get_by_id_with_relations(db, session.winner_film_id)
            items.append(
                RecommendationHistoryItem(
                    session_id=session.id,
                    winner_film_id=session.winner_film_id,
                    winner_title=winner.title if winner else "Unknown",
                    winner_year=winner.year if winner else None,
                    winner_poster_url=(
                        winner.metadata_.poster_url
                        if winner and winner.metadata_
                        else None
                    ),
                    winner_watch_status=winner.status.value if winner else None,
                    preference_summary=session.profile.narrative_profile or "",
                    created_at=session.created_at,
                )
            )
        return RecommendationHistoryListResponse(
            data=items,
            pagination={
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(items) < total,
            },
        )

    def delete_session(self, db: Session, session_id: uuid.UUID) -> None:
        from app.core.exceptions import not_found

        session = recommendation_session_repository.get_by_id(db, session_id)
        if session is None:
            raise not_found("Recommendation session")

        affected_film_ids: set[uuid.UUID] = set()
        winner_film_id = session.winner_film_id
        for candidate in session.candidates:
            affected_film_ids.add(candidate.film_id)
            is_winner = (
                winner_film_id is not None and candidate.film_id == winner_film_id
            )
            recommendation_exposure_repository.decrement_exposure(
                db,
                film_id=candidate.film_id,
                is_winner=is_winner,
            )

        for film_id in affected_film_ids:
            recommendation_exposure_repository.recompute_last_recommended_at(
                db,
                film_id=film_id,
                exclude_session_id=session_id,
            )

        recommendation_session_repository.delete_by_id(db, session_id)
        db.commit()

    def _stage1_filter(
        self, db: Session, questionnaire: dict[str, Any]
    ) -> tuple[list[Any], dict[str, Any] | None]:
        runtime_pref = questionnaire.get("runtime", "any")
        subtitle_pref = questionnaire.get("subtitle_preference", "no_preference")
        runtime_max = runtime_ceiling(runtime_pref)
        exclude_non_english = subtitle_pref == "no"

        films = film_repository.list_recommendation_candidates(
            db,
            runtime_max=runtime_max,
            exclude_non_english=exclude_non_english,
        )
        relaxation: dict[str, Any] | None = None

        if len(films) < MIN_CANDIDATES:
            relaxed_runtime = runtime_max
            if runtime_max is not None:
                relaxed_runtime = runtime_max + 30
                films = film_repository.list_recommendation_candidates(
                    db,
                    runtime_max=relaxed_runtime,
                    exclude_non_english=exclude_non_english,
                )
                relaxation = {
                    "runtime_minutes": {
                        "original": runtime_max,
                        "relaxed_to": relaxed_runtime,
                    }
                }

        if len(films) < MIN_CANDIDATES and exclude_non_english:
            films = film_repository.list_recommendation_candidates(
                db,
                runtime_max=relaxed_runtime if runtime_max is not None else None,
                exclude_non_english=False,
            )
            language_relaxation = {"relaxed": True}
            if relaxation is None:
                relaxation = {"original_language": language_relaxation}
            else:
                relaxation["original_language"] = language_relaxation

        if len(films) < 1:
            return [], relaxation
        return films, relaxation

    def _stage2_retrieve(
        self,
        db: Session,
        films: list[Any],
        profile_embedding: list[float],
    ) -> list[PipelineCandidate]:
        if not films:
            return []
        config = get_app_config()
        limit = min(config.recommendation.retrieval_candidate_limit, len(films))
        film_ids = [film.id for film in films]
        active_version = system_version_repository.get_active_version(db, "film-embedding")
        embedding_version = active_version.version if active_version else "embedding-v1"
        vector_literal = "[" + ",".join(str(v) for v in profile_embedding) + "]"
        stmt = text(
            """
            SELECT fe.film_id,
                   (1 - (fe.embedding <=> CAST(:profile_embedding AS vector))) AS similarity
            FROM film_embeddings fe
            WHERE fe.film_id = ANY(:film_ids)
              AND fe.embedding_type = :embedding_type
              AND fe.embedding_version = :embedding_version
            ORDER BY fe.embedding <=> CAST(:profile_embedding AS vector)
            LIMIT :limit
            """
        )
        rows = db.execute(
            stmt,
            {
                "profile_embedding": vector_literal,
                "film_ids": film_ids,
                "embedding_type": EmbeddingType.SEMANTIC.value,
                "embedding_version": embedding_version,
                "limit": limit,
            },
        ).all()

        film_map = {film.id: film for film in films}
        retrieved: list[PipelineCandidate] = []
        for rank, row in enumerate(rows, start=1):
            film = film_map.get(row.film_id)
            if film is None:
                continue
            retrieved.append(
                PipelineCandidate(
                    film_id=row.film_id,
                    film=film,
                    retrieval_rank=rank,
                    similarity_score=float(row.similarity),
                    raw_score=0.0,
                    final_score=0.0,
                    score_breakdown={},
                )
            )

        if not retrieved:
            for rank, film in enumerate(films[:limit], start=1):
                retrieved.append(
                    PipelineCandidate(
                        film_id=film.id,
                        film=film,
                        retrieval_rank=rank,
                        similarity_score=0.5,
                        raw_score=0.0,
                        final_score=0.0,
                        score_breakdown={},
                    )
                )
        return retrieved

    def _stage5_stochastic(self, diversified: list[Any]) -> list[Any]:
        if not diversified:
            return []
        top_score = diversified[0].final_score
        band = [item for item in diversified if item.final_score >= top_score - STOCHASTIC_BAND]
        if len(band) <= 1:
            return diversified[:20]
        weights = [max(item.final_score, 0.01) for item in band]
        promoted = random.choices(band, weights=weights, k=1)[0]
        remainder = [item for item in diversified if item.film_id != promoted.film_id]
        return [promoted, *remainder[:19]]

    def _merge_ranking(
        self,
        retrieved: list[PipelineCandidate],
        diversified: list[Any],
        ranking_result: Any,
        shortlist: list[Any],
    ) -> list[PipelineCandidate]:
        retrieval_map = {item.film_id: item for item in retrieved}
        diversity_map = {item.film_id: item for item in diversified}
        ordered_ids = [ranking_result.winner_film_id, *ranking_result.runners_up_film_ids]
        for item in shortlist:
            if item.film_id not in ordered_ids:
                ordered_ids.append(item.film_id)

        merged: list[PipelineCandidate] = []
        for rank, film_id in enumerate(ordered_ids, start=1):
            base = retrieval_map.get(film_id)
            scored = diversity_map.get(film_id)
            if base is None and scored is None:
                continue
            merged.append(
                PipelineCandidate(
                    film_id=film_id,
                    film=base.film if base else scored.film,
                    retrieval_rank=base.retrieval_rank if base else None,
                    similarity_score=base.similarity_score if base else None,
                    raw_score=scored.raw_score if scored else 0.0,
                    final_score=scored.final_score if scored else 0.0,
                    score_breakdown=scored.score_breakdown if scored else {},
                    llm_rank=rank if film_id in ordered_ids[:5] else None,
                )
            )
        return merged

    def _active_versions(self, db: Session) -> dict[str, str]:
        versions: dict[str, str] = {}
        for artifact_type, key in (
            (ArtifactType.SEMANTIC, "semantic"),
            (ArtifactType.EMBEDDING, "embedding"),
            (ArtifactType.SCORING, "scoring"),
            (ArtifactType.PROMPT, "prompt"),
        ):
            rows = system_version_repository.get_active_by_artifact_type(db, artifact_type)
            if rows:
                versions[key] = rows[0].version
        return versions


def _film_result(film, explanation, *, is_winner: bool) -> FilmResult:
    metadata = film.metadata_ if film else None
    if explanation is None:
        expl = Explanation(
            why_it_matches="Matches your stated preferences.",
            most_influential_factors=["semantic fit"],
            why_it_matches_short="Strong preference match.",
            why_it_beat_alternatives="Highest overall score." if is_winner else None,
            caveats=None,
        )
    elif isinstance(explanation, Explanation):
        expl = explanation
    else:
        expl = _explanation_from_payload(explanation)
    return FilmResult(
        film_id=film.id,
        title=film.title,
        year=film.year,
        runtime=metadata.runtime if metadata else None,
        director=metadata.director if metadata else None,
        synopsis=metadata.synopsis if metadata else None,
        letterboxd_rating=float(metadata.letterboxd_rating) if metadata and metadata.letterboxd_rating else None,
        tmdb_rating=float(metadata.tmdb_rating) if metadata and metadata.tmdb_rating is not None else None,
        rotten_tomatoes_score=metadata.rotten_tomatoes_score if metadata else None,
        poster_url=metadata.poster_url if metadata else None,
        explanation=expl,
    )


def _factors_from_payload(payload: dict[str, Any]) -> list[str]:
    for key in ("most_influential_factors", "key_factors", "influential_factors"):
        raw = payload.get(key)
        if isinstance(raw, list):
            factors = [str(item).strip() for item in raw if str(item).strip()]
            if factors:
                return factors[:5]
    return []


def _optional_short_reason(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _explanation_to_payload(explanation: Explanation | Any) -> dict[str, Any]:
    if isinstance(explanation, Explanation):
        return {
            "why_it_matches": explanation.why_it_matches,
            "why_it_matches_short": explanation.why_it_matches_short,
            "most_influential_factors": list(explanation.most_influential_factors or [])[:5],
            "why_it_beat_alternatives": explanation.why_it_beat_alternatives,
            "caveats": explanation.caveats,
        }
    if hasattr(explanation, "why_it_matches"):
        return {
            "why_it_matches": explanation.why_it_matches,
            "why_it_matches_short": _optional_short_reason(
                getattr(explanation, "why_it_matches_short", None)
            ),
            "most_influential_factors": list(explanation.most_influential_factors or [])[:5],
            "why_it_beat_alternatives": explanation.why_it_beat_alternatives,
            "caveats": explanation.caveats,
        }
    if isinstance(explanation, dict):
        return {
            "why_it_matches": str(explanation.get("why_it_matches", "")),
            "why_it_matches_short": _optional_short_reason(
                explanation.get("why_it_matches_short")
            ),
            "most_influential_factors": _factors_from_payload(explanation),
            "why_it_beat_alternatives": explanation.get("why_it_beat_alternatives"),
            "caveats": explanation.get("caveats"),
        }
    return {
        "why_it_matches": "Matches your stated preferences.",
        "why_it_matches_short": "Strong preference match.",
        "most_influential_factors": ["semantic fit"],
        "why_it_beat_alternatives": None,
        "caveats": None,
    }


def _explanation_from_payload(payload: dict | Any) -> Explanation:
    if hasattr(payload, "why_it_matches"):
        return Explanation(
            why_it_matches=payload.why_it_matches,
            most_influential_factors=list(payload.most_influential_factors or [])[:5],
            why_it_matches_short=_optional_short_reason(
                getattr(payload, "why_it_matches_short", None)
            ),
            why_it_beat_alternatives=payload.why_it_beat_alternatives,
            caveats=payload.caveats,
        )
    if isinstance(payload, dict):
        factors = _factors_from_payload(payload)
        return Explanation(
            why_it_matches=str(payload.get("why_it_matches", "")),
            most_influential_factors=factors,
            why_it_matches_short=_optional_short_reason(
                payload.get("why_it_matches_short")
            ),
            why_it_beat_alternatives=payload.get("why_it_beat_alternatives"),
            caveats=payload.get("caveats"),
        )
    return Explanation(
        why_it_matches="Matches your stated preferences.",
        most_influential_factors=["semantic fit"],
        why_it_matches_short="Strong preference match.",
        why_it_beat_alternatives=None,
        caveats=None,
    )
