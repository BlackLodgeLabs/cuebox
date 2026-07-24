"""PostgreSQL enum definitions mirrored in ORM models."""

import enum


class FilmStatus(str, enum.Enum):
    ACTIVE = "active"
    PENDING_WATCH_REVIEW = "pending_watch_review"
    WATCHED = "watched"
    ARCHIVED = "archived"


class WatchSource(str, enum.Enum):
    MANUAL = "manual"
    RSS = "rss"
    LETTERBOXD_IMPORT = "letterboxd_import"


class FilmAddSource(str, enum.Enum):
    MANUAL = "manual"


class ReviewType(str, enum.Enum):
    TMDB_MATCH = "tmdb_match"
    LETTERBOXD_URI = "letterboxd_uri"


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
