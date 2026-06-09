"""Recommendation endpoints per api-contracts.md §7–8."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import validation_error
from app.dependencies import get_db, get_recommendation_service
from app.schemas.recommendations import (
    CreateRecommendationRequest,
    CreateRecommendationResponse,
    RecommendationHistoryListResponse,
    RecommendationSessionDetail,
)
from app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post("", response_model=CreateRecommendationResponse)
async def create_recommendation(
    body: CreateRecommendationRequest,
    db: Session = Depends(get_db),
    recommendation_service: RecommendationService = Depends(get_recommendation_service),
) -> CreateRecommendationResponse:
    return await recommendation_service.create_recommendation(db, body)


@router.get("/{session_id}", response_model=RecommendationSessionDetail)
def get_recommendation_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    recommendation_service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationSessionDetail:
    return recommendation_service.get_session(db, session_id)


@router.get("", response_model=RecommendationHistoryListResponse)
def list_recommendation_history(
    search: str | None = None,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    watch_status: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    recommendation_service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationHistoryListResponse:
    if watch_status == "unwatched":
        watch_status = "active"
    elif watch_status is not None and watch_status not in {"watched", "active", "archived"}:
        raise validation_error("Invalid watch_status value")
    return recommendation_service.list_history(
        db,
        search=search,
        date_from=date_from,
        date_to=date_to,
        watch_status=watch_status,
        limit=limit,
        offset=offset,
    )
