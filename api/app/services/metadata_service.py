"""TMDB metadata matching and enrichment."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.exceptions import conflict, not_found
from app.database.enums import EnrichmentStatus, ReviewStatus
from app.database.models import Film
from app.providers.tmdb import TmdbClient, TmdbMovieDetails
from app.repositories import (
    film_metadata_repository,
    film_repository,
    import_job_repository,
    metadata_review_repository,
)
from app.services.confidence import compute_confidence, confidence_action
from app.services.provider_service import ProviderService

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EnrichmentOutcome:
    film_id: uuid.UUID
    status: EnrichmentStatus
    failure_reason: str | None = None


class MetadataService:
    def __init__(self, provider_service: ProviderService) -> None:
        self._providers = provider_service

    async def enrich_film(self, db: Session, film_id: uuid.UUID) -> EnrichmentOutcome:
        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise not_found("Film")

        film_repository.update_enrichment_status(db, film, EnrichmentStatus.MATCHING)
        db.flush()

        try:
            tmdb = self._providers.get_tmdb_client()
        except Exception as exc:
            return self._mark_failed(db, film, str(exc))

        try:
            search_results = await tmdb.search_movie(film.title, year=film.year)
        except httpx.HTTPError as exc:
            return self._mark_failed(db, film, f"TMDB search failed: {exc}")

        if not search_results:
            return self._mark_failed(db, film, "TMDB match not found")

        best_score = -1.0
        best_details: TmdbMovieDetails | None = None
        best_keywords: list[str] = []
        for candidate in search_results[:5]:
            try:
                details = await tmdb.get_movie_details(candidate.tmdb_id)
                keywords = await tmdb.get_movie_keywords(candidate.tmdb_id)
            except httpx.HTTPError:
                continue
            score = compute_confidence(
                csv_title=film.title,
                csv_year=film.year,
                csv_director=None,
                tmdb_title=details.title,
                tmdb_original_title=details.original_title,
                tmdb_year=details.year,
                tmdb_director=details.director,
            )
            if score > best_score:
                best_score = score
                best_details = details
                best_keywords = keywords

        if best_details is None:
            return self._mark_failed(db, film, "TMDB match not found")

        action = confidence_action(best_score)
        payload = self._candidate_payload(best_details, tmdb)

        if action == "manual_review":
            metadata_review_repository.create(
                db,
                film_id=film.id,
                candidate_tmdb_id=best_details.tmdb_id,
                confidence_score=best_score,
                candidate_payload=payload,
            )
            film_repository.update_enrichment_status(db, film, EnrichmentStatus.REVIEW_REQUIRED)
            return EnrichmentOutcome(film_id=film.id, status=EnrichmentStatus.REVIEW_REQUIRED)

        await self._persist_metadata(
            db, film, best_details, best_keywords, best_score, tmdb
        )

        if action == "accept_flag":
            metadata_review_repository.create(
                db,
                film_id=film.id,
                candidate_tmdb_id=best_details.tmdb_id,
                confidence_score=best_score,
                candidate_payload=payload,
            )

        film_repository.update_enrichment_status(db, film, EnrichmentStatus.ENRICHING)
        return EnrichmentOutcome(film_id=film.id, status=EnrichmentStatus.ENRICHING)

    async def accept_review(self, db: Session, review_id: uuid.UUID) -> Film:
        review = metadata_review_repository.get_by_id(db, review_id)
        if review is None:
            raise not_found("Review")
        if review.review_status != ReviewStatus.PENDING:
            raise conflict("Review is already accepted or rejected")

        film = film_repository.get_by_id(db, review.film_id)
        if film is None:
            raise not_found("Film")
        if film.enrichment_status != EnrichmentStatus.REVIEW_REQUIRED:
            raise conflict("Film is not awaiting metadata review")

        tmdb = self._providers.get_tmdb_client()
        details = await tmdb.get_movie_details(review.candidate_tmdb_id)
        keywords = await tmdb.get_movie_keywords(review.candidate_tmdb_id)
        await self._persist_metadata(
            db,
            film,
            details,
            keywords,
            float(review.confidence_score),
            tmdb,
        )
        metadata_review_repository.update_status(db, review, ReviewStatus.ACCEPTED)
        film_repository.update_enrichment_status(db, film, EnrichmentStatus.ENRICHING)
        return film

    def reject_review(self, db: Session, review_id: uuid.UUID) -> Film:
        review = metadata_review_repository.get_by_id(db, review_id)
        if review is None:
            raise not_found("Review")
        if review.review_status != ReviewStatus.PENDING:
            raise conflict("Review is already accepted or rejected")

        film = film_repository.get_by_id(db, review.film_id)
        if film is None:
            raise not_found("Film")

        metadata_review_repository.update_status(db, review, ReviewStatus.REJECTED)
        outcome = self._mark_failed(db, film, "Metadata match rejected by user")
        updated = film_repository.get_by_id(db, outcome.film_id)
        assert updated is not None
        return updated

    async def _persist_metadata(
        self,
        db: Session,
        film: Film,
        details: TmdbMovieDetails,
        keywords: list[str],
        confidence: float,
        tmdb: TmdbClient,
    ) -> None:
        rt_score: int | None = None
        omdb = self._providers.get_omdb_client()
        if omdb and details.imdb_id:
            try:
                rt_score = await omdb.get_rotten_tomatoes_score(details.imdb_id)
            except httpx.HTTPError as exc:
                logger.warning("OMDb supplementation failed for %s: %s", film.id, exc)

        film_metadata_repository.upsert(
            db,
            film.id,
            tmdb_id=details.tmdb_id,
            imdb_id=details.imdb_id,
            original_title=details.original_title,
            runtime=details.runtime,
            synopsis=details.overview,
            genres=details.genres,
            keywords=keywords,
            original_language=details.original_language,
            country=details.country,
            director=details.director,
            tmdb_rating=Decimal(str(details.vote_average)) if details.vote_average else None,
            rotten_tomatoes_score=rt_score,
            poster_url=TmdbClient.poster_url(details.poster_path),
            backdrop_url=TmdbClient.backdrop_url(details.backdrop_path),
            match_confidence=Decimal(str(confidence)),
            metadata_source="tmdb",
        )

    def _mark_failed(self, db: Session, film: Film, reason: str) -> EnrichmentOutcome:
        film_repository.update_enrichment_status(db, film, EnrichmentStatus.FAILED)
        if film.import_job_id:
            job = import_job_repository.get_by_id(db, film.import_job_id)
            if job is not None:
                summary = list(job.failure_summary or [])
                summary.append({"letterboxd_uri": film.letterboxd_uri, "reason": reason})
                import_job_repository.update_counters(
                    db,
                    job,
                    failed_films=job.failed_films + 1,
                    failure_summary=summary,
                )
        return EnrichmentOutcome(
            film_id=film.id,
            status=EnrichmentStatus.FAILED,
            failure_reason=reason,
        )

    @staticmethod
    def _candidate_payload(details: TmdbMovieDetails, tmdb: TmdbClient) -> dict[str, Any]:
        return {
            "tmdb_id": details.tmdb_id,
            "title": details.title,
            "year": details.year,
            "director": details.director,
            "poster_url": TmdbClient.poster_url(details.poster_path),
        }
