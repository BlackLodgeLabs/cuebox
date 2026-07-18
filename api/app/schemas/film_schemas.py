"""Film API schemas per api-contracts.md §4."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PaginationMeta(BaseModel):
    total: int
    limit: int
    offset: int
    has_more: bool


class FilmStatusRequest(BaseModel):
    status: str


class FilmSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    year: int | None
    letterboxd_uri: str
    status: str
    enrichment_status: str
    poster_url: str | None = None
    director: str | None = None
    runtime: int | None = None
    genres: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    removed_at: datetime | None = None
    latest_watched_at: date | None = None
    watch_review_incomplete: bool = False
    pending_watch: "FilmWatchSummary | None" = None


class FilmListResponse(BaseModel):
    data: list[FilmSummary]
    pagination: PaginationMeta


class FilmMetadataBlock(BaseModel):
    tmdb_id: int | None = None
    imdb_id: str | None = None
    original_title: str | None = None
    runtime: int | None = None
    synopsis: str | None = None
    genres: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    original_language: str | None = None
    country: str | None = None
    director: str | None = None
    tmdb_rating: float | None = None
    rotten_tomatoes_score: int | None = None
    letterboxd_rating: float | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    match_confidence: float | None = None
    metadata_source: str | None = None


class SemanticProfileBlock(BaseModel):
    subgenres: list[str] = Field(default_factory=list)
    themes: list[str] = Field(default_factory=list)
    tones: list[str] = Field(default_factory=list)
    visual_descriptors: list[str] = Field(default_factory=list)
    emotional_outcomes: list[str] = Field(default_factory=list)
    viewing_contexts: list[str] = Field(default_factory=list)
    complexity: float | None = None
    pacing: float | None = None
    energy: float | None = None
    obscurity: float | None = None
    semantic_summary: str | None = None
    semantic_version: str
    generated_by_model: str
    generated_at: datetime


class FilmDetail(BaseModel):
    id: UUID
    title: str
    year: int | None
    letterboxd_uri: str
    status: str
    enrichment_status: str
    metadata: FilmMetadataBlock | None = None
    semantic_profile: SemanticProfileBlock | None = None
    watches: list["FilmWatchSummary"] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class FilmWatchSummary(BaseModel):
    id: UUID
    score: float
    watched_at: date
    notes: str | None = None
    source: str
    is_pending: bool
    created_at: datetime
    updated_at: datetime


class ReviewRequiredItem(BaseModel):
    film_id: UUID
    title: str
    year: int | None
    letterboxd_uri: str
    review_id: UUID
    review_type: str = "tmdb_match"
    candidate_tmdb_id: int
    confidence_score: float
    candidate_payload: dict
    created_at: datetime


class ReviewRequiredListResponse(BaseModel):
    data: list[ReviewRequiredItem]
    pagination: PaginationMeta


class TmdbSearchResultItem(BaseModel):
    tmdb_id: int
    title: str
    original_title: str
    year: int | None
    overview: str | None
    poster_url: str | None


class TmdbSearchResponse(BaseModel):
    data: list[TmdbSearchResultItem]
    pagination: PaginationMeta


class RematchRequest(BaseModel):
    tmdb_id: int


class RematchResponse(BaseModel):
    film_id: UUID
    enrichment_status: str


class WatchlistAddRequest(BaseModel):
    tmdb_id: int


class WatchlistAddResponse(BaseModel):
    film_id: UUID
    enrichment_status: str | None = None
    already_on_watchlist: bool = False
    restored: bool = False
    review_id: UUID | None = None
