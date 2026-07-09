"""Watchlist management endpoints."""

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_provider_service, get_watchlist_add_service
from app.schemas.film_schemas import WatchlistAddRequest, WatchlistAddResponse
from app.services.enrichment_pipeline import run_semantic_pipeline_for_film
from app.services.provider_service import ProviderService
from app.services.watchlist_add_service import WatchlistAddService

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


@router.post("/films", response_model=WatchlistAddResponse)
async def add_film_to_watchlist(
    body: WatchlistAddRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    watchlist_add_service: WatchlistAddService = Depends(get_watchlist_add_service),
    provider_service: ProviderService = Depends(get_provider_service),
) -> JSONResponse:
    outcome = await watchlist_add_service.add_film(db, body.tmdb_id)
    db.commit()

    if outcome.enrichment_status == "enriching":
        background_tasks.add_task(run_semantic_pipeline_for_film, outcome.film_id, provider_service)

    response = WatchlistAddResponse(
        film_id=outcome.film_id,
        enrichment_status=outcome.enrichment_status,
        already_on_watchlist=outcome.already_on_watchlist,
        restored=outcome.restored,
        review_id=outcome.review_id,
    )
    return JSONResponse(
        status_code=outcome.http_status,
        content=response.model_dump(mode="json"),
    )
