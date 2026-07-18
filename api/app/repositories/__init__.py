"""Data access layer (Repository pattern)."""

from app.repositories import (
    film_embedding_repository,
    film_metadata_repository,
    film_repository,
    film_watch_repository,
    import_job_repository,
    metadata_review_repository,
    semantic_profile_repository,
    system_version_repository,
    watchlist_repository,
)

__all__ = [
    "film_embedding_repository",
    "film_metadata_repository",
    "film_repository",
    "film_watch_repository",
    "import_job_repository",
    "metadata_review_repository",
    "semantic_profile_repository",
    "system_version_repository",
    "watchlist_repository",
]
