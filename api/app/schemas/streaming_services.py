"""My services settings and the country provider catalog."""

from __future__ import annotations

from pydantic import BaseModel, Field


class StreamingServicesResponse(BaseModel):
    country_code: str
    provider_ids: list[int] = Field(default_factory=list)


class StreamingServicesUpdate(BaseModel):
    provider_ids: list[int] = Field(default_factory=list)


class StreamingCatalogItem(BaseModel):
    provider_id: int
    provider_name: str
    logo_url: str | None
    display_priority: int


class StreamingCatalogResponse(BaseModel):
    country_code: str
    providers: list[StreamingCatalogItem] = Field(default_factory=list)
