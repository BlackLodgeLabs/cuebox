"""Synchronisation API schemas per api-contracts.md §6."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class FilmSyncSummary(BaseModel):
    film_id: uuid.UUID
    title: str
    year: int | None = None


class SyncCsvResponse(BaseModel):
    added: int
    unchanged: int
    failed: int
    added_films: list[FilmSyncSummary]


class RssConfigRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)


class RssConfigResponse(BaseModel):
    username: str
    polling_interval_seconds: int
    configured_at: datetime


class RssStatusResponse(BaseModel):
    configured: bool
    username: str | None = None
    polling_interval_seconds: int
    last_polled_at: datetime | None = None
    last_poll_status: str | None = None
    events_processed_last_poll: int | None = None
