"""User settings. My services stores TMDB provider ids for the configured country."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, validation_error
from app.dependencies import get_db, get_provider_service
from app.providers.tmdb import TmdbClient
from app.repositories import streaming_repository
from app.schemas.errors import ErrorCode
from app.schemas.streaming_services import (
    StreamingCatalogItem,
    StreamingCatalogResponse,
    StreamingServicesResponse,
    StreamingServicesUpdate,
)
from app.services.provider_service import ProviderService
from app.services.streaming_availability_service import configured_country

router = APIRouter(prefix="/settings", tags=["settings"])

_MAX_SERVICES = 100


def _clean_provider_ids(provider_ids: list[int]) -> list[int]:
    cleaned: list[int] = []
    for provider_id in provider_ids:
        if provider_id <= 0:
            raise validation_error("provider_ids must be positive TMDB provider ids")
        if provider_id not in cleaned:
            cleaned.append(provider_id)
    if len(cleaned) > _MAX_SERVICES:
        raise validation_error(f"Choose at most {_MAX_SERVICES} services")
    return cleaned


@router.get("/services", response_model=StreamingServicesResponse)
def get_streaming_services(db: Session = Depends(get_db)) -> StreamingServicesResponse:
    country = configured_country()
    return StreamingServicesResponse(
        country_code=country,
        provider_ids=streaming_repository.list_provider_ids(db, country),
    )


@router.put("/services", response_model=StreamingServicesResponse)
def put_streaming_services(
    body: StreamingServicesUpdate,
    db: Session = Depends(get_db),
) -> StreamingServicesResponse:
    country = configured_country()
    stored = streaming_repository.replace_provider_ids(
        db,
        country,
        _clean_provider_ids(body.provider_ids),
    )
    db.commit()
    return StreamingServicesResponse(country_code=country, provider_ids=stored)


@router.get("/services/catalog", response_model=StreamingCatalogResponse)
async def get_streaming_catalog(
    provider_service: ProviderService = Depends(get_provider_service),
) -> StreamingCatalogResponse:
    country = configured_country()
    try:
        tmdb = provider_service.get_tmdb_client()
    except AppError as exc:
        if exc.code == ErrorCode.PROVIDER_ERROR:
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message=exc.message,
                status_code=503,
            ) from exc
        raise
    try:
        entries = await tmdb.list_movie_watch_providers(country_code=country)
    except httpx.HTTPError as exc:
        raise AppError(
            code=ErrorCode.PROVIDER_ERROR,
            message=f"TMDB provider catalog failed: {exc}",
            status_code=502,
        ) from exc

    ordered = sorted(entries, key=lambda item: (item.display_priority, item.provider_name.lower()))
    seen: set[int] = set()
    providers: list[StreamingCatalogItem] = []
    for entry in ordered:
        if entry.provider_id in seen:
            continue
        seen.add(entry.provider_id)
        providers.append(
            StreamingCatalogItem(
                provider_id=entry.provider_id,
                provider_name=entry.provider_name,
                logo_url=TmdbClient.provider_logo_url(entry.logo_path),
                display_priority=entry.display_priority,
            )
        )
    return StreamingCatalogResponse(country_code=country, providers=providers)
