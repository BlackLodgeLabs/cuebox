"""PostgreSQL enum definitions mirrored in ORM models."""

import enum


class FilmStatus(str, enum.Enum):
    ACTIVE = "active"
    WATCHED = "watched"
    ARCHIVED = "archived"


class EnrichmentStatus(str, enum.Enum):
    PENDING = "pending"
    MATCHING = "matching"
    REVIEW_REQUIRED = "review_required"
    ENRICHING = "enriching"
    READY = "ready"
    FAILED = "failed"


class ImportJobStatus(str, enum.Enum):
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"


class ReviewStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class EmbeddingType(str, enum.Enum):
    SEMANTIC = "semantic"
    SYNOPSIS = "synopsis"
    THEME = "theme"


class RssEventType(str, enum.Enum):
    WATCHLIST_ADD = "watchlist_add"
    WATCHLIST_REMOVE = "watchlist_remove"
    WATCHED = "watched"


class ArtifactType(str, enum.Enum):
    SEMANTIC = "semantic"
    EMBEDDING = "embedding"
    SCORING = "scoring"
    PROMPT = "prompt"
