"""Standardized API error envelope per api-contracts.md §2."""

from enum import StrEnum

from pydantic import BaseModel, Field


class ErrorCode(StrEnum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    INVALID_CSV_FORMAT = "INVALID_CSV_FORMAT"
    WATCHLIST_SIZE_EXCEEDED = "WATCHLIST_SIZE_EXCEEDED"
    NO_PREFERENCE_CONFLICT = "NO_PREFERENCE_CONFLICT"
    ENRICHMENT_NOT_READY = "ENRICHMENT_NOT_READY"
    INSUFFICIENT_CANDIDATES = "INSUFFICIENT_CANDIDATES"
    PROVIDER_ERROR = "PROVIDER_ERROR"
    UNPROCESSABLE = "UNPROCESSABLE"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    code: ErrorCode
    message: str
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody = Field(..., description="Standardized error envelope")
