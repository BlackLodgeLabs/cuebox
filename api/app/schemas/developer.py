"""Developer Mode API schemas per api-contracts.md §9."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DevProfileTrace(BaseModel):
    profile_id: uuid.UUID
    profile_hash: str
    structured_profile: dict[str, Any]
    narrative_profile: str | None
    embedding_model: str | None
    embedding_version: str | None
    profile_cache_hit: bool


class DevRetrievalCandidate(BaseModel):
    film_id: uuid.UUID
    title: str
    retrieval_rank: int | None
    similarity_score: float | None


class DevRetrievalTraceResponse(BaseModel):
    session_id: uuid.UUID
    profile: DevProfileTrace
    candidates: list[DevRetrievalCandidate]
    retrieval_candidate_limit: int
    candidates_returned: int


class DevScoringCandidate(BaseModel):
    film_id: uuid.UUID
    title: str
    raw_score: float | None
    final_score: float | None
    llm_rank: int | None
    score_breakdown: dict[str, float]


class DevScoringDetailResponse(BaseModel):
    session_id: uuid.UUID
    scoring_version: str | None
    weight_set: str | None
    weights: dict[str, float]
    candidates: list[DevScoringCandidate]


class DevProviderDetail(BaseModel):
    provider: str
    model: str
    semantic_version: str | None = None
    embedding_version: str | None = None
    prompt_version: str | None = None
    tokens_input: int | None = None
    tokens_output: int | None = None


class DevSemanticEnrichmentDetail(BaseModel):
    provider: str
    model: str
    semantic_version: str | None


class DevEmbeddingDetail(BaseModel):
    provider: str
    model: str
    embedding_version: str | None


class DevRankingDetail(BaseModel):
    provider: str
    model: str
    prompt_version: str | None
    tokens_input: int | None
    tokens_output: int | None


class DevAIDetailResponse(BaseModel):
    session_id: uuid.UUID
    semantic_enrichment: DevSemanticEnrichmentDetail
    embedding: DevEmbeddingDetail
    ranking: DevRankingDetail


class DevFilmMatchResponse(BaseModel):
    film_id: uuid.UUID
    tmdb_id: int | None
    imdb_id: str | None
    match_confidence: float | None
    metadata_source: str | None
    enrichment_status: str


class DevSystemVersionEntry(BaseModel):
    artifact_type: str
    artifact_name: str
    version: str
    active: bool
    created_at: datetime


class DevSystemVersionsResponse(BaseModel):
    versions: list[DevSystemVersionEntry]
