"""Real-time TMDB watch provider resolution for watchlist films."""

from __future__ import annotations

import uuid

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_app_config
from app.core.exceptions import AppError, not_found, unprocessable
from app.providers.tmdb import TmdbClient, TmdbWatchProviderEntry
from app.repositories import film_metadata_repository, film_repository
from app.schemas.errors import ErrorCode
from app.schemas.watch_providers import (
    FilmWatchProvidersResponse,
    WatchProviderCategory,
    WatchProviderItem,
)
from app.services.provider_service import ProviderService

_CATEGORY_SPECS: tuple[tuple[str, str, str], ...] = (
    ("flatrate", "Stream", "flatrate"),
    ("rent", "Rent", "rent"),
    ("buy", "Buy", "buy"),
    ("ads", "Free with Ads", "ads"),
)


class WatchProviderService:
    def __init__(self, provider_service: ProviderService) -> None:
        self._providers = provider_service

    async def get_watch_providers(
        self,
        db: Session,
        film_id: uuid.UUID,
        *,
        country_code: str | None = None,
    ) -> FilmWatchProvidersResponse:
        config = get_app_config()
        resolved_country = country_code or config.watch_providers.country_code or "GB"

        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise not_found("Film")

        metadata = film_metadata_repository.get_by_film_id(db, film_id)
        if metadata is None or metadata.tmdb_id is None:
            raise unprocessable("Match TMDB metadata to see streaming options.")

        try:
            tmdb = self._providers.get_tmdb_client()
        except AppError as exc:
            if exc.code == ErrorCode.PROVIDER_ERROR:
                raise AppError(
                    code=ErrorCode.PROVIDER_ERROR,
                    message=exc.message,
                    status_code=503,
                ) from exc
            raise

        try:
            result = await tmdb.get_movie_watch_providers(
                metadata.tmdb_id,
                country_code=resolved_country,
            )
        except httpx.HTTPError as exc:
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message=f"TMDB watch providers failed: {exc}",
                status_code=502,
            ) from exc

        categories = self._build_categories(result)
        return FilmWatchProvidersResponse(
            film_id=film_id,
            tmdb_id=metadata.tmdb_id,
            country_code=resolved_country,
            link=result.link,
            categories=categories,
        )

    def _build_categories(self, result) -> list[WatchProviderCategory]:
        categories: list[WatchProviderCategory] = []
        for type_key, label, attr in _CATEGORY_SPECS:
            entries: list[TmdbWatchProviderEntry] = getattr(result, attr)
            if not entries:
                continue
            sorted_entries = sorted(entries, key=lambda item: item.display_priority)
            providers = [
                WatchProviderItem(
                    provider_id=entry.provider_id,
                    provider_name=entry.provider_name,
                    logo_url=TmdbClient.provider_logo_url(entry.logo_path),
                    display_priority=entry.display_priority,
                )
                for entry in sorted_entries
            ]
            categories.append(
                WatchProviderCategory(
                    type=type_key,  # type: ignore[arg-type]
                    label=label,  # type: ignore[arg-type]
                    providers=providers,
                )
            )
        return categories
