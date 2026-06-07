"""Database layer — SQLAlchemy base, session, and ORM models."""

from app.database.base import Base
from app.database.enums import (
    ArtifactType,
    EmbeddingType,
    EnrichmentStatus,
    FilmStatus,
    ImportJobStatus,
    ReviewStatus,
    RssEventType,
)
from app.database.models import (
    Film,
    FilmEmbedding,
    FilmMetadata,
    FilmSemanticProfile,
    ImportJob,
    MetadataMatchReview,
    RecommendationCandidate,
    RecommendationExposure,
    RecommendationProfile,
    RecommendationResult,
    RecommendationSession,
    RssSyncEvent,
    SystemVersion,
    WatchlistEntry,
)
from app.database.session import SessionLocal, check_database, get_db, get_engine, init_engine

__all__ = [
    "ArtifactType",
    "Base",
    "EmbeddingType",
    "EnrichmentStatus",
    "Film",
    "FilmEmbedding",
    "FilmMetadata",
    "FilmSemanticProfile",
    "FilmStatus",
    "ImportJob",
    "ImportJobStatus",
    "MetadataMatchReview",
    "RecommendationCandidate",
    "RecommendationExposure",
    "RecommendationProfile",
    "RecommendationResult",
    "RecommendationSession",
    "ReviewStatus",
    "RssEventType",
    "RssSyncEvent",
    "SessionLocal",
    "SystemVersion",
    "WatchlistEntry",
    "check_database",
    "get_db",
    "get_engine",
    "init_engine",
]
