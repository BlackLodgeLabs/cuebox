"""Recommendation API schemas per api-contracts.md §7–8."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.schemas.errors import ErrorDetail


NO_PREFERENCE = "No Preference"


class RuntimePreference(StrEnum):
    LE_90 = "le_90"
    LE_120 = "le_120"
    LE_150 = "le_150"
    ANY = "any"


class ViewingContext(StrEnum):
    SOLO = "solo"
    WITH_OTHERS = "with_others"


class ThinkingEffort(StrEnum):
    BRAIN_OFF = "brain_off"
    DECENT_PLOT = "decent_plot"
    COMPLEX_PUZZLE = "complex_puzzle"


class PacingPreference(StrEnum):
    SLOW_BURN = "slow_burn"
    BALANCED = "balanced"
    FAST_PACED = "fast_paced"
    NO_PREFERENCE = "no_preference"


class EraPreference(StrEnum):
    CURRENT = "current"
    MODERN_CLASSICS = "modern_classics"
    VINTAGE = "vintage"
    NO_PREFERENCE = "no_preference"


class SubtitlePreference(StrEnum):
    YES = "yes"
    NO = "no"
    NO_PREFERENCE = "no_preference"


class ObscurityPreference(StrEnum):
    MAINSTREAM = "mainstream"
    HIDDEN_GEMS = "hidden_gems"
    OBSCURE = "obscure"
    NO_PREFERENCE = "no_preference"


class QuestionnaireRequest(BaseModel):
    genres: list[str] = Field(..., min_length=1)
    runtime: RuntimePreference
    viewing_context: ViewingContext
    thinking_effort: ThinkingEffort
    pacing: PacingPreference
    emotional_outcomes: list[str] = Field(..., min_length=1)
    visual_tonal_vibes: list[str] = Field(..., min_length=1)
    era: EraPreference
    subtitle_preference: SubtitlePreference
    obscurity_preference: ObscurityPreference

    @field_validator("genres", "emotional_outcomes", "visual_tonal_vibes")
    @classmethod
    def validate_no_preference_conflict(cls, values: list[str]) -> list[str]:
        if NO_PREFERENCE in values and len(values) > 1:
            from app.core.exceptions import AppError
            from app.schemas.errors import ErrorCode

            raise AppError(
                code=ErrorCode.NO_PREFERENCE_CONFLICT,
                message="'No Preference' cannot be combined with other selections.",
                status_code=400,
                details=[
                    ErrorDetail(
                        field="questionnaire",
                        message="'No Preference' cannot be combined with other selections.",
                    )
                ],
            )
        return values


class CreateRecommendationRequest(BaseModel):
    questionnaire: QuestionnaireRequest
    notes: str | None = Field(default=None, max_length=1000)


class Explanation(BaseModel):
    why_it_matches: str
    most_influential_factors: list[str]
    why_it_beat_alternatives: str | None = None
    caveats: str | None = None


class ConstraintRelaxation(BaseModel):
    runtime_minutes: dict[str, int] | None = None
    original_language: dict[str, bool] | None = None

    def to_json(self) -> dict[str, Any]:
        data: dict[str, Any] = {}
        if self.runtime_minutes is not None:
            data["runtime_minutes"] = self.runtime_minutes
        if self.original_language is not None:
            data["original_language"] = self.original_language
        return data or {}


class FilmResult(BaseModel):
    film_id: uuid.UUID
    title: str
    year: int | None = None
    runtime: int | None = None
    director: str | None = None
    letterboxd_rating: float | None = None
    rotten_tomatoes_score: int | None = None
    poster_url: str | None = None
    explanation: Explanation


class ProfileSummary(BaseModel):
    narrative_profile: str | None = None
    structured_profile: dict[str, Any]


class CreateRecommendationResponse(BaseModel):
    session_id: uuid.UUID
    profile_id: uuid.UUID
    profile_cache_hit: bool
    winner: FilmResult
    runners_up: list[FilmResult]
    constraint_relaxation: dict[str, Any] | None = None
    created_at: datetime


class RecommendationSessionDetail(CreateRecommendationResponse):
    profile_summary: ProfileSummary | None = None


class RecommendationHistoryItem(BaseModel):
    session_id: uuid.UUID
    winner_film_id: uuid.UUID | None = None
    winner_title: str
    winner_year: int | None = None
    winner_poster_url: str | None = None
    winner_watch_status: str | None = None
    preference_summary: str
    created_at: datetime


class PaginationEnvelope(BaseModel):
    total: int
    limit: int
    offset: int
    has_more: bool


class RecommendationHistoryListResponse(BaseModel):
    data: list[RecommendationHistoryItem]
    pagination: PaginationEnvelope
