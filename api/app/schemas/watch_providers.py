"""Watch provider API schemas."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field


class WatchProviderItem(BaseModel):
    provider_id: int
    provider_name: str
    logo_url: str | None
    display_priority: int


class WatchProviderCategory(BaseModel):
    type: Literal["flatrate", "rent", "buy", "ads"]
    label: Literal["Stream", "Rent", "Buy", "Free with Ads"]
    providers: list[WatchProviderItem]


class FilmWatchProvidersResponse(BaseModel):
    film_id: uuid.UUID
    tmdb_id: int
    country_code: str
    link: str | None = None
    categories: list[WatchProviderCategory] = Field(default_factory=list)
