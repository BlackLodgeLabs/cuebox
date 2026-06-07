"""Data access layer (Repository pattern)."""

from app.repositories import (
    film_metadata_repository,
    film_repository,
    import_job_repository,
    metadata_review_repository,
    system_version_repository,
    watchlist_repository,
)

__all__ = [
    "film_metadata_repository",
    "film_repository",
    "import_job_repository",
    "metadata_review_repository",
    "system_version_repository",
    "watchlist_repository",
]
