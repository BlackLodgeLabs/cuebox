"""Developer Mode endpoints per api-contracts.md §9."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_app_config
from app.dependencies import get_db, get_developer_service
from app.schemas.developer import (
    DevAIDetailResponse,
    DevFilmMatchResponse,
    DevRetrievalTraceResponse,
    DevScoringDetailResponse,
    DevSystemVersionsResponse,
)
from app.services.developer_service import DeveloperService

router = APIRouter(prefix="/dev", tags=["developer"])


def require_developer_mode() -> None:
    if not get_app_config().developer_mode:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


@router.get(
    "/recommendations/{session_id}/retrieval",
    response_model=DevRetrievalTraceResponse,
    dependencies=[Depends(require_developer_mode)],
)
def get_session_retrieval_trace(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    developer_service: DeveloperService = Depends(get_developer_service),
) -> DevRetrievalTraceResponse:
    return developer_service.get_retrieval_trace(db, session_id)


@router.get(
    "/recommendations/{session_id}/scoring",
    response_model=DevScoringDetailResponse,
    dependencies=[Depends(require_developer_mode)],
)
def get_session_scoring_detail(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    developer_service: DeveloperService = Depends(get_developer_service),
) -> DevScoringDetailResponse:
    return developer_service.get_scoring_detail(db, session_id)


@router.get(
    "/recommendations/{session_id}/ai",
    response_model=DevAIDetailResponse,
    dependencies=[Depends(require_developer_mode)],
)
def get_session_ai_detail(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    developer_service: DeveloperService = Depends(get_developer_service),
) -> DevAIDetailResponse:
    return developer_service.get_ai_detail(db, session_id)


@router.get(
    "/films/{film_id}/match",
    response_model=DevFilmMatchResponse,
    dependencies=[Depends(require_developer_mode)],
)
def get_film_match_metadata(
    film_id: uuid.UUID,
    db: Session = Depends(get_db),
    developer_service: DeveloperService = Depends(get_developer_service),
) -> DevFilmMatchResponse:
    return developer_service.get_film_match(db, film_id)


@router.get(
    "/system/versions",
    response_model=DevSystemVersionsResponse,
    dependencies=[Depends(require_developer_mode)],
)
def get_active_system_versions(
    db: Session = Depends(get_db),
    developer_service: DeveloperService = Depends(get_developer_service),
) -> DevSystemVersionsResponse:
    return developer_service.get_system_versions(db)
