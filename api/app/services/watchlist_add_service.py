"""Orchestrate manual watchlist film adds."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, conflict, not_found
from app.database.enums import EnrichmentStatus, FilmStatus, ReviewType
from app.database.models import Film
from app.providers.tmdb import TmdbClient, TmdbMovieDetails
from app.repositories import (
    film_metadata_repository,
    film_repository,
    metadata_review_repository,
    watchlist_repository,
)
from app.schemas.errors import ErrorCode, ErrorDetail
from app.services.letterboxd_resolver import resolve_letterboxd_uri
from app.services.letterboxd_uri import canonical_film_uri
from app.services.metadata_service import MetadataService
from app.services.provider_service import ProviderService


def pending_letterboxd_uri(film_id: uuid.UUID) -> str:
    return f"https://letterboxd.com/film/_pending-manual-{film_id}/"


@dataclass(frozen=True)
class WatchlistAddOutcome:
    film_id: uuid.UUID
    http_status: int
    already_on_watchlist: bool = False
    restored: bool = False
    enrichment_status: str | None = None
    review_id: uuid.UUID | None = None


class WatchlistAddService:
    def __init__(self, provider_service: ProviderService) -> None:
        self._providers = provider_service

    async def add_film(self, db: Session, tmdb_id: int) -> WatchlistAddOutcome:
        tmdb = self._providers.get_tmdb_client()
        try:
            details = await tmdb.get_movie_details(tmdb_id)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise not_found("TMDB movie") from exc
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message=f"TMDB lookup failed: {exc}",
                status_code=502,
            ) from exc
        except httpx.HTTPError as exc:
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message=f"TMDB lookup failed: {exc}",
                status_code=502,
            ) from exc

        letterboxd_uri = await resolve_letterboxd_uri(
            tmdb_id,
            title=details.title,
            year=details.year,
            original_title=details.original_title,
        )
        if letterboxd_uri is None:
            existing_pending = metadata_review_repository.find_pending_letterboxd_by_tmdb_id(
                db, tmdb_id
            )
            if existing_pending is not None:
                film, review = existing_pending
                return WatchlistAddOutcome(
                    film_id=film.id,
                    http_status=202,
                    enrichment_status=EnrichmentStatus.REVIEW_REQUIRED.value,
                    review_id=review.id,
                )
            return await self._create_review_required_stub(db, tmdb_id, details, tmdb)

        return await self._add_with_resolved_uri(db, tmdb_id, details, tmdb, letterboxd_uri)

    async def _add_with_resolved_uri(
        self,
        db: Session,
        tmdb_id: int,
        details: TmdbMovieDetails,
        tmdb: TmdbClient,
        letterboxd_uri: str,
    ) -> WatchlistAddOutcome:
        canonical_uri = canonical_film_uri(letterboxd_uri)
        existing = film_repository.get_by_letterboxd_uri(db, canonical_uri)

        if existing is not None:
            active_entry = watchlist_repository.get_active_by_film_id(db, existing.id)
            if active_entry is not None and existing.status == FilmStatus.ACTIVE:
                return WatchlistAddOutcome(
                    film_id=existing.id,
                    http_status=200,
                    already_on_watchlist=True,
                )

            if existing.status in (FilmStatus.ARCHIVED, FilmStatus.WATCHED):
                film_repository.restore_active(db, existing)
                watchlist_repository.ensure_active_entry(
                    db, film_id=existing.id, letterboxd_uri=canonical_uri
                )
                await self._ensure_metadata_and_enrich(
                    db, existing, tmdb_id, details, tmdb, re_enrich_only_if_not_ready=True
                )
                return WatchlistAddOutcome(
                    film_id=existing.id,
                    http_status=202,
                    restored=True,
                    enrichment_status=existing.enrichment_status.value,
                )

        conflicting = film_metadata_repository.get_by_tmdb_id(db, tmdb_id)
        if conflicting is not None:
            other = film_repository.get_by_id(db, conflicting.film_id)
            if other is not None:
                active_entry = watchlist_repository.get_active_by_film_id(db, other.id)
                if active_entry is not None and other.status == FilmStatus.ACTIVE:
                    return WatchlistAddOutcome(
                        film_id=other.id,
                        http_status=200,
                        already_on_watchlist=True,
                    )
                if other.enrichment_status == EnrichmentStatus.REVIEW_REQUIRED:
                    pending = metadata_review_repository.find_pending_letterboxd_for_film(
                        db, other.id
                    )
                    if pending is not None:
                        return WatchlistAddOutcome(
                            film_id=other.id,
                            http_status=202,
                            enrichment_status=EnrichmentStatus.REVIEW_REQUIRED.value,
                            review_id=pending.id,
                        )
            title = other.title if other else str(conflicting.film_id)
            details_list = None
            if other is not None:
                details_list = [
                    ErrorDetail(field="film_id", message=str(other.id)),
                ]
            raise conflict(
                f"TMDB ID {tmdb_id} is already linked to film \"{title}\"",
                details=details_list,
            )

        if existing is None:
            film = film_repository.create_manual(
                db,
                title=details.title,
                letterboxd_uri=canonical_uri,
                year=details.year,
                enrichment_status=EnrichmentStatus.ENRICHING,
            )
            watchlist_repository.ensure_active_entry(
                db, film_id=film.id, letterboxd_uri=canonical_uri
            )
            await self._persist_manual_metadata(db, film, details, tmdb)
            return WatchlistAddOutcome(
                film_id=film.id,
                http_status=202,
                enrichment_status=EnrichmentStatus.ENRICHING.value,
            )

        # Existing film without active watchlist entry (inactive/pending states)
        watchlist_repository.ensure_active_entry(
            db, film_id=existing.id, letterboxd_uri=canonical_uri
        )
        await self._ensure_metadata_and_enrich(
            db, existing, tmdb_id, details, tmdb, re_enrich_only_if_not_ready=False
        )
        return WatchlistAddOutcome(
            film_id=existing.id,
            http_status=202,
            enrichment_status=existing.enrichment_status.value,
        )

    async def _ensure_metadata_and_enrich(
        self,
        db: Session,
        film: Film,
        tmdb_id: int,
        details: TmdbMovieDetails,
        tmdb: TmdbClient,
        *,
        re_enrich_only_if_not_ready: bool,
    ) -> None:
        if re_enrich_only_if_not_ready and film.enrichment_status == EnrichmentStatus.READY:
            return
        await self._persist_manual_metadata(db, film, details, tmdb)
        film_repository.update_enrichment_status(db, film, EnrichmentStatus.ENRICHING)

    async def _persist_manual_metadata(
        self,
        db: Session,
        film: Film,
        details: TmdbMovieDetails,
        tmdb: TmdbClient,
    ) -> None:
        metadata_service = MetadataService(self._providers)
        keywords = await tmdb.get_movie_keywords(details.tmdb_id)
        try:
            await metadata_service._persist_metadata(
                db,
                film,
                details,
                keywords,
                tmdb,
                metadata_source="tmdb_manual_add",
                match_confidence=1.0,
            )
        except IntegrityError as exc:
            db.rollback()
            raise conflict("Duplicate TMDB metadata record") from exc

    async def _create_review_required_stub(
        self,
        db: Session,
        tmdb_id: int,
        details: TmdbMovieDetails,
        tmdb: TmdbClient,
    ) -> WatchlistAddOutcome:
        temp_uri = f"https://letterboxd.com/film/_pending-temp-{uuid.uuid4()}/"
        film = film_repository.create_manual(
            db,
            title=details.title,
            letterboxd_uri=temp_uri,
            year=details.year,
            enrichment_status=EnrichmentStatus.REVIEW_REQUIRED,
        )
        film_repository.update_letterboxd_uri(db, film, pending_letterboxd_uri(film.id))

        payload = MetadataService._candidate_payload(details, tmdb)
        review = metadata_review_repository.create(
            db,
            film_id=film.id,
            candidate_tmdb_id=tmdb_id,
            confidence_score=1.0,
            candidate_payload=payload,
            review_type=ReviewType.LETTERBOXD_URI,
        )
        return WatchlistAddOutcome(
            film_id=film.id,
            http_status=202,
            enrichment_status=EnrichmentStatus.REVIEW_REQUIRED.value,
            review_id=review.id,
        )
