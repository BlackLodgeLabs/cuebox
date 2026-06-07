"""Import API schemas per api-contracts.md §3."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ImportJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: UUID
    status: str
    created_at: datetime


class FailureSummaryItem(BaseModel):
    letterboxd_uri: str
    reason: str


class ImportJobStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: UUID
    status: str
    total_films: int | None
    processed_films: int
    failed_films: int
    duplicate_films: int
    failure_summary: list[FailureSummaryItem] | None = None
    created_at: datetime
    completed_at: datetime | None = None
