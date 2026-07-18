"""SQLAlchemy ORM models matching database-design.md."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import CHAR, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.enums import (
    ArtifactType,
    EmbeddingType,
    EnrichmentStatus,
    FilmAddSource,
    FilmStatus,
    ImportJobStatus,
    WatchSource,
    ReviewStatus,
    ReviewType,
    RssEventType,
)

def _enum_values(enum_cls: type) -> list[str]:
    return [member.value for member in enum_cls]


# Reusable enum column factories (types created in Alembic migration)
_enum_kwargs = {"create_constraint": False, "values_callable": _enum_values}
FilmStatusEnum = SAEnum(FilmStatus, name="film_status", **_enum_kwargs)
EnrichmentStatusEnum = SAEnum(EnrichmentStatus, name="enrichment_status", **_enum_kwargs)
ImportJobStatusEnum = SAEnum(ImportJobStatus, name="import_job_status", **_enum_kwargs)
ReviewStatusEnum = SAEnum(ReviewStatus, name="review_status", **_enum_kwargs)
EmbeddingTypeEnum = SAEnum(EmbeddingType, name="embedding_type", **_enum_kwargs)
RssEventTypeEnum = SAEnum(RssEventType, name="rss_event_type", **_enum_kwargs)
ArtifactTypeEnum = SAEnum(ArtifactType, name="artifact_type", **_enum_kwargs)


class ImportJob(Base):
    __tablename__ = "import_jobs"
    __table_args__ = (
        CheckConstraint(
            "total_films IS NULL OR processed_films <= total_films",
            name="chk_import_jobs_processed_lte_total",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status: Mapped[ImportJobStatus] = mapped_column(
        ImportJobStatusEnum, nullable=False, default=ImportJobStatus.RUNNING
    )
    total_films: Mapped[int | None] = mapped_column(Integer)
    processed_films: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_films: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duplicate_films: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failure_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    films: Mapped[list[Film]] = relationship(back_populates="import_job")


class Film(Base):
    __tablename__ = "films"
    __table_args__ = (
        CheckConstraint(
            "year IS NULL OR (year >= 1880 AND year <= EXTRACT(YEAR FROM now()) + 2)",
            name="chk_films_year_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    year: Mapped[int | None] = mapped_column(SmallInteger)
    letterboxd_uri: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    status: Mapped[FilmStatus] = mapped_column(
        FilmStatusEnum, nullable=False, default=FilmStatus.ACTIVE
    )
    enrichment_status: Mapped[EnrichmentStatus] = mapped_column(
        EnrichmentStatusEnum, nullable=False, default=EnrichmentStatus.PENDING
    )
    import_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("import_jobs.id", ondelete="SET NULL")
    )
    add_source: Mapped[FilmAddSource | None] = mapped_column(
        SAEnum(FilmAddSource, native_enum=False, values_callable=_enum_values),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    import_job: Mapped[ImportJob | None] = relationship(back_populates="films")
    metadata_: Mapped[FilmMetadata | None] = relationship(back_populates="film", uselist=False)
    semantic_profile: Mapped[FilmSemanticProfile | None] = relationship(
        back_populates="film", uselist=False
    )
    embeddings: Mapped[list[FilmEmbedding]] = relationship(back_populates="film")
    watchlist_entries: Mapped[list[WatchlistEntry]] = relationship(back_populates="film")
    match_reviews: Mapped[list[MetadataMatchReview]] = relationship(back_populates="film")
    watches: Mapped[list[FilmWatch]] = relationship(back_populates="film")
    exposure: Mapped[RecommendationExposure | None] = relationship(
        back_populates="film", uselist=False
    )


class FilmWatch(Base):
    __tablename__ = "film_watches"
    __table_args__ = (
        CheckConstraint(
            "score >= 0.5 AND score <= 5.0",
            name="chk_film_watches_score_range",
        ),
        CheckConstraint(
            "source IN ('manual', 'rss')",
            name="chk_film_watches_source",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    film_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("films.id", ondelete="CASCADE"), nullable=False
    )
    score: Mapped[Decimal] = mapped_column(Numeric(2, 1), nullable=False)
    watched_at: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    source: Mapped[WatchSource] = mapped_column(
        SAEnum(WatchSource, native_enum=False, values_callable=_enum_values),
        nullable=False,
    )
    is_pending: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    film: Mapped[Film] = relationship(back_populates="watches")


class FilmMetadata(Base):
    __tablename__ = "film_metadata"
    __table_args__ = (
        CheckConstraint("runtime IS NULL OR runtime > 0", name="chk_film_metadata_runtime_positive"),
        CheckConstraint(
            "tmdb_rating IS NULL OR (tmdb_rating >= 0 AND tmdb_rating <= 10)",
            name="chk_film_metadata_tmdb_rating_range",
        ),
        CheckConstraint(
            "rotten_tomatoes_score IS NULL OR "
            "(rotten_tomatoes_score >= 0 AND rotten_tomatoes_score <= 100)",
            name="chk_film_metadata_rt_score_range",
        ),
        CheckConstraint(
            "letterboxd_rating IS NULL OR "
            "(letterboxd_rating >= 0 AND letterboxd_rating <= 5)",
            name="chk_film_metadata_lb_rating_range",
        ),
        CheckConstraint(
            "match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)",
            name="chk_film_metadata_match_confidence_range",
        ),
    )

    film_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("films.id", ondelete="CASCADE"), primary_key=True
    )
    tmdb_id: Mapped[int | None] = mapped_column(Integer, unique=True)
    imdb_id: Mapped[str | None] = mapped_column(Text, unique=True)
    original_title: Mapped[str | None] = mapped_column(Text)
    runtime: Mapped[int | None] = mapped_column(SmallInteger)
    synopsis: Mapped[str | None] = mapped_column(Text)
    genres: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    keywords: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    original_language: Mapped[str | None] = mapped_column(CHAR(2))
    country: Mapped[str | None] = mapped_column(Text)
    director: Mapped[str | None] = mapped_column(Text)
    tmdb_rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 1))
    rotten_tomatoes_score: Mapped[int | None] = mapped_column(SmallInteger)
    letterboxd_rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    poster_url: Mapped[str | None] = mapped_column(Text)
    backdrop_url: Mapped[str | None] = mapped_column(Text)
    match_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    metadata_source: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    film: Mapped[Film] = relationship(back_populates="metadata_")


class FilmSemanticProfile(Base):
    __tablename__ = "film_semantic_profiles"
    __table_args__ = (
        CheckConstraint(
            "complexity IS NULL OR (complexity >= 0 AND complexity <= 10)",
            name="chk_fsp_complexity_range",
        ),
        CheckConstraint(
            "pacing IS NULL OR (pacing >= 0 AND pacing <= 10)",
            name="chk_fsp_pacing_range",
        ),
        CheckConstraint(
            "energy IS NULL OR (energy >= 0 AND energy <= 10)",
            name="chk_fsp_energy_range",
        ),
        CheckConstraint(
            "obscurity IS NULL OR (obscurity >= 0 AND obscurity <= 10)",
            name="chk_fsp_obscurity_range",
        ),
    )

    film_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("films.id", ondelete="CASCADE"), primary_key=True
    )
    subgenres: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    themes: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    tones: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    visual_descriptors: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    emotional_outcomes: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    viewing_contexts: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    complexity: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    pacing: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    energy: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    obscurity: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    semantic_summary: Mapped[str | None] = mapped_column(Text)
    semantic_version: Mapped[str] = mapped_column(Text, nullable=False)
    generated_by_model: Mapped[str] = mapped_column(Text, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    film: Mapped[Film] = relationship(back_populates="semantic_profile")


class FilmEmbedding(Base):
    __tablename__ = "film_embeddings"

    film_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("films.id", ondelete="CASCADE"), primary_key=True
    )
    embedding_type: Mapped[EmbeddingType] = mapped_column(EmbeddingTypeEnum, primary_key=True)
    embedding_version: Mapped[str] = mapped_column(Text, primary_key=True)
    embedding_model: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Any] = mapped_column(Vector(1536), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    film: Mapped[Film] = relationship(back_populates="embeddings")


class WatchlistEntry(Base):
    __tablename__ = "watchlist_entries"
    __table_args__ = (
        CheckConstraint(
            "removed_at IS NULL OR removed_at >= added_at",
            name="chk_watchlist_removed_after_added",
        ),
        # Partial unique index uq_watchlist_film_active is migration-only (not ORM constraint)
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    film_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("films.id", ondelete="CASCADE"), nullable=False
    )
    letterboxd_uri: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    film: Mapped[Film] = relationship(back_populates="watchlist_entries")


class MetadataMatchReview(Base):
    __tablename__ = "metadata_match_reviews"
    __table_args__ = (
        CheckConstraint(
            "confidence_score >= 0 AND confidence_score <= 1",
            name="chk_mmr_confidence_range",
        ),
        CheckConstraint(
            "reviewed_at IS NULL OR review_status IN ('accepted', 'rejected')",
            name="chk_mmr_reviewed_at_requires_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    film_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("films.id", ondelete="CASCADE"), nullable=False
    )
    candidate_tmdb_id: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    candidate_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    review_status: Mapped[ReviewStatus] = mapped_column(
        ReviewStatusEnum, nullable=False, default=ReviewStatus.PENDING
    )
    review_type: Mapped[ReviewType] = mapped_column(
        SAEnum(ReviewType, native_enum=False, values_callable=_enum_values),
        nullable=False,
        default=ReviewType.TMDB_MATCH,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    film: Mapped[Film] = relationship(back_populates="match_reviews")


class RecommendationProfile(Base):
    __tablename__ = "recommendation_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False, unique=True)
    structured_profile: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    narrative_profile: Mapped[str | None] = mapped_column(Text)
    embedding_model: Mapped[str | None] = mapped_column(Text)
    embedding_version: Mapped[str | None] = mapped_column(Text)
    embedding: Mapped[Any | None] = mapped_column(Vector(1536))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sessions: Mapped[list[RecommendationSession]] = relationship(back_populates="profile")


class RecommendationSession(Base):
    __tablename__ = "recommendation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recommendation_profiles.id"), nullable=False
    )
    winner_film_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("films.id", ondelete="SET NULL")
    )
    ranking_provider: Mapped[str | None] = mapped_column(Text)
    ranking_model: Mapped[str | None] = mapped_column(Text)
    semantic_version: Mapped[str | None] = mapped_column(Text)
    embedding_version: Mapped[str | None] = mapped_column(Text)
    scoring_version: Mapped[str | None] = mapped_column(Text)
    weight_set: Mapped[str | None] = mapped_column(Text)
    prompt_version: Mapped[str | None] = mapped_column(Text)
    constraint_relaxation: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    tokens_input: Mapped[int | None] = mapped_column(Integer)
    tokens_output: Mapped[int | None] = mapped_column(Integer)
    profile_cache_hit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped[RecommendationProfile] = relationship(back_populates="sessions")
    candidates: Mapped[list[RecommendationCandidate]] = relationship(back_populates="session")
    result: Mapped[RecommendationResult | None] = relationship(
        back_populates="session", uselist=False
    )


class RecommendationCandidate(Base):
    __tablename__ = "recommendation_candidates"
    __table_args__ = (
        CheckConstraint(
            "similarity_score IS NULL OR "
            "(similarity_score >= -1 AND similarity_score <= 1)",
            name="chk_rc_similarity_range",
        ),
        CheckConstraint(
            "llm_rank IS NULL OR llm_rank > 0",
            name="chk_rc_llm_rank_positive",
        ),
    )

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recommendation_sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    film_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("films.id", ondelete="CASCADE"), primary_key=True
    )
    retrieval_rank: Mapped[int | None] = mapped_column(Integer)
    similarity_score: Mapped[Decimal | None] = mapped_column(Numeric(8, 6))
    raw_score: Mapped[Decimal | None] = mapped_column(Numeric(8, 6))
    final_score: Mapped[Decimal | None] = mapped_column(Numeric(8, 6))
    llm_rank: Mapped[int | None] = mapped_column(SmallInteger)
    score_breakdown: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    session: Mapped[RecommendationSession] = relationship(back_populates="candidates")


class RecommendationResult(Base):
    __tablename__ = "recommendation_results"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recommendation_sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    winner_explanation: Mapped[str | None] = mapped_column(Text)
    winner_explanation_detail: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    runner_up_explanations: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    session: Mapped[RecommendationSession] = relationship(back_populates="result")


class RecommendationExposure(Base):
    __tablename__ = "recommendation_exposure"
    __table_args__ = (
        CheckConstraint(
            "recommendation_count >= 0 AND winner_count >= 0",
            name="chk_re_counts_non_negative",
        ),
        CheckConstraint(
            "winner_count <= recommendation_count",
            name="chk_re_winner_lte_recommendations",
        ),
    )

    film_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("films.id", ondelete="CASCADE"), primary_key=True
    )
    recommendation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    winner_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_recommended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    film: Mapped[Film] = relationship(back_populates="exposure")


class SyncConfig(Base):
    __tablename__ = "sync_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rss_username: Mapped[str | None] = mapped_column(Text)
    configured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_polled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_poll_status: Mapped[str | None] = mapped_column(Text)
    events_processed_last_poll: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RssSyncEvent(Base):
    __tablename__ = "rss_sync_events"
    __table_args__ = (
        CheckConstraint(
            "processed_at IS NULL OR processed = TRUE",
            name="chk_rss_processed_at_requires_flag",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[RssEventType] = mapped_column(RssEventTypeEnum, nullable=False)
    event_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    letterboxd_uri: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    processed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SystemVersion(Base):
    __tablename__ = "system_versions"
    __table_args__ = (
        UniqueConstraint("artifact_name", "version", name="uq_system_versions_name_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artifact_type: Mapped[ArtifactType] = mapped_column(ArtifactTypeEnum, nullable=False)
    artifact_name: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[str] = mapped_column(Text, nullable=False)
    configuration: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
