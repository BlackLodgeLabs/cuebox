"""Resolve configured metadata provider clients."""

from __future__ import annotations

import httpx

from app.core.config import AppConfig, Settings
from app.core.exceptions import AppError
from app.providers.omdb import OmdbClient
from app.providers.tmdb import TmdbClient
from app.schemas.errors import ErrorCode

_HTTP_TIMEOUT = httpx.Timeout(connect=5.0, read=30.0, write=30.0, pool=5.0)


class ProviderService:
    def __init__(self, settings: Settings, config: AppConfig) -> None:
        self._settings = settings
        self._config = config
        self._http_client: httpx.AsyncClient | None = None
        self._tmdb: TmdbClient | None = None
        self._omdb: OmdbClient | None = None

    async def startup(self) -> None:
        if self._http_client is not None:
            return
        self._http_client = httpx.AsyncClient(timeout=_HTTP_TIMEOUT)
        if self._config.providers.metadata.tmdb.enabled and self._settings.tmdb_api_key:
            self._tmdb = TmdbClient(self._http_client, self._settings.tmdb_api_key)
        if (
            self._config.providers.metadata.omdb.enabled
            and self._settings.omdb_api_key
        ):
            self._omdb = OmdbClient(self._http_client, self._settings.omdb_api_key)

    async def shutdown(self) -> None:
        if self._http_client is not None:
            await self._http_client.aclose()
        self._http_client = None
        self._tmdb = None
        self._omdb = None

    def get_tmdb_client(self) -> TmdbClient:
        if self._tmdb is None:
            raise AppError(
                code=ErrorCode.PROVIDER_ERROR,
                message="TMDB provider is not configured or TMDB_API_KEY is missing",
                status_code=500,
            )
        return self._tmdb

    def get_omdb_client(self) -> OmdbClient | None:
        return self._omdb
