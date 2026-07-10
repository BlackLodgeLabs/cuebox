"""Map ORM models to API response schemas."""

from __future__ import annotations

from app.database.models import Film, FilmMetadata, FilmSemanticProfile
from app.schemas.film_schemas import (
    FilmDetail,
    FilmMetadataBlock,
    FilmSummary,
    ReviewRequiredItem,
    SemanticProfileBlock,
)


def film_to_summary(film: Film) -> FilmSummary:
    metadata: FilmMetadata | None = film.metadata_
    return FilmSummary(
        id=film.id,
        title=film.title,
        year=film.year,
        letterboxd_uri=film.letterboxd_uri,
        status=film.status.value,
        enrichment_status=film.enrichment_status.value,
        poster_url=metadata.poster_url if metadata else None,
        director=metadata.director if metadata else None,
        runtime=metadata.runtime if metadata else None,
        genres=list(metadata.genres) if metadata else [],
        created_at=film.created_at,
        updated_at=film.updated_at,
    )


def metadata_to_block(metadata: FilmMetadata) -> FilmMetadataBlock:
    return FilmMetadataBlock(
        tmdb_id=metadata.tmdb_id,
        imdb_id=metadata.imdb_id,
        original_title=metadata.original_title,
        runtime=metadata.runtime,
        synopsis=metadata.synopsis,
        genres=list(metadata.genres),
        keywords=list(metadata.keywords),
        original_language=metadata.original_language,
        country=metadata.country,
        director=metadata.director,
        tmdb_rating=float(metadata.tmdb_rating) if metadata.tmdb_rating is not None else None,
        rotten_tomatoes_score=metadata.rotten_tomatoes_score,
        letterboxd_rating=float(metadata.letterboxd_rating)
        if metadata.letterboxd_rating is not None
        else None,
        poster_url=metadata.poster_url,
        backdrop_url=metadata.backdrop_url,
        match_confidence=float(metadata.match_confidence)
        if metadata.match_confidence is not None
        else None,
        metadata_source=metadata.metadata_source,
    )


def semantic_to_block(profile: FilmSemanticProfile) -> SemanticProfileBlock:
    return SemanticProfileBlock(
        subgenres=list(profile.subgenres),
        themes=list(profile.themes),
        tones=list(profile.tones),
        visual_descriptors=list(profile.visual_descriptors),
        emotional_outcomes=list(profile.emotional_outcomes),
        viewing_contexts=list(profile.viewing_contexts),
        complexity=float(profile.complexity) if profile.complexity is not None else None,
        pacing=float(profile.pacing) if profile.pacing is not None else None,
        energy=float(profile.energy) if profile.energy is not None else None,
        obscurity=float(profile.obscurity) if profile.obscurity is not None else None,
        semantic_summary=profile.semantic_summary,
        semantic_version=profile.semantic_version,
        generated_by_model=profile.generated_by_model,
        generated_at=profile.generated_at,
    )


def film_to_detail(film: Film) -> FilmDetail:
    metadata_block = None
    if film.metadata_ is not None:
        metadata_block = metadata_to_block(film.metadata_)

    semantic_block = None
    if film.semantic_profile is not None:
        semantic_block = semantic_to_block(film.semantic_profile)

    return FilmDetail(
        id=film.id,
        title=film.title,
        year=film.year,
        letterboxd_uri=film.letterboxd_uri,
        status=film.status.value,
        enrichment_status=film.enrichment_status.value,
        metadata=metadata_block,
        semantic_profile=semantic_block,
        created_at=film.created_at,
        updated_at=film.updated_at,
    )


def review_to_item(film: Film, review) -> ReviewRequiredItem:
    review_type = review.review_type
    if hasattr(review_type, "value"):
        review_type = review_type.value
    return ReviewRequiredItem(
        film_id=film.id,
        title=film.title,
        year=film.year,
        letterboxd_uri=film.letterboxd_uri,
        review_id=review.id,
        review_type=review_type,
        candidate_tmdb_id=review.candidate_tmdb_id,
        confidence_score=float(review.confidence_score),
        candidate_payload=review.candidate_payload or {},
        created_at=review.created_at,
    )
