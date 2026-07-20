"""Watch review API schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.film_schemas import PaginationMeta


class FilmWatchBlock(BaseModel):
    id: UUID
    score: float | None
    watched_at: date
    notes: str | None = None
    source: str
    is_pending: bool
    created_at: datetime
    updated_at: datetime


class CompleteWatchReviewRequest(BaseModel):
    score: float = Field(ge=0.5, le=5.0)
    watched_at: date
    notes: str | None = None


class UpdateWatchRequest(BaseModel):
    score: float = Field(ge=0.5, le=5.0)
    watched_at: date
    notes: str | None = None


class WatchReviewRequiredItem(BaseModel):
    film_id: UUID
    title: str
    year: int | None
    letterboxd_uri: str
    poster_url: str | None = None
    pending_watch: FilmWatchBlock
    created_at: datetime


class WatchReviewRequiredListResponse(BaseModel):
    data: list[WatchReviewRequiredItem]
    pagination: PaginationMeta


class PendingReviewCountResponse(BaseModel):
    metadata_count: int
    watch_review_count: int
    total: int
