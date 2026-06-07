"""Metadata match review API schemas per api-contracts.md §5."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReviewActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    review_id: UUID
    film_id: UUID
    review_status: str
    reviewed_at: datetime
