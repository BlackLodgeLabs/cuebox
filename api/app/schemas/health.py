"""Health check response schema per api-contracts.md §10.1."""

from typing import Literal

from pydantic import BaseModel


class HealthProviders(BaseModel):
    embedding: Literal["ok", "error"]
    semantic_enrichment: Literal["ok", "error"]
    ranking: Literal["ok", "error"]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    database: Literal["ok", "error"]
    providers: HealthProviders
    version: str
