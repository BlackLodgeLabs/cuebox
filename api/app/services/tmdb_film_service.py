"""TMDB trailer lookup and the lighter not-on-watchlist film page."""

from __future__ import annotations

import uuid

import httpx
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, not_found
from app.providers.tmdb import TmdbClient, select_youtube_trailer
from app.repositories import film_metadata_repository, film_repository
from app.schemas.errors import ErrorCode
from app.schemas.film_schemas import FilmTrailerResponse, TmdbFilmResponse
from app.services.provider_service import ProviderService


def _tmdb_http_error(exc: httpx.HTTPError, action: str) -> AppError:
    return AppError(
        code=ErrorCode.PROVIDER_ERROR,
        message=f"TMDB {action} failed: {exc}",
        status_code=502,
    )


class TmdbFilmService:
    def __init__(self, provider_service: ProviderService) -> None:
        self._providers = provider_service

    def _tmdb_client(self) -> TmdbClient:
        try:
            return self._providers.get_tmdb_client()
        except AppError as exc:
            if exc.code == ErrorCode.PROVIDER_ERROR:
                raise AppError(
                    code=ErrorCode.PROVIDER_ERROR,
                    message=exc.message,
                    status_code=503,
                ) from exc
            raise

    async def get_trailer(self, db: Session, film_id: uuid.UUID) -> FilmTrailerResponse:
        film = film_repository.get_by_id(db, film_id)
        if film is None:
            raise not_found("Film")

        metadata = film_metadata_repository.get_by_film_id(db, film_id)
        if metadata is None or metadata.tmdb_id is None:
            return FilmTrailerResponse(url=None, name=None, site=None)

        try:
            videos = await self._tmdb_client().get_movie_videos(metadata.tmdb_id)
        except httpx.HTTPError as exc:
            raise _tmdb_http_error(exc, "videos") from exc

        chosen = select_youtube_trailer(videos)
        if chosen is None:
            return FilmTrailerResponse(url=None, name=None, site=None)
        return FilmTrailerResponse(
            url=TmdbClient.youtube_url(chosen.key),
            name=chosen.name,
            site=chosen.site,
        )

    async def get_tmdb_film(self, db: Session, tmdb_id: int) -> TmdbFilmResponse:
        client = self._tmdb_client()
        try:
            details = await client.get_movie_details(tmdb_id)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise not_found("Film") from exc
            raise _tmdb_http_error(exc, "film lookup") from exc
        except httpx.HTTPError as exc:
            raise _tmdb_http_error(exc, "film lookup") from exc

        try:
            videos = await client.get_movie_videos(tmdb_id)
        except httpx.HTTPError as exc:
            raise _tmdb_http_error(exc, "videos") from exc

        chosen = select_youtube_trailer(videos)
        film_id = None
        status = None
        metadata = film_metadata_repository.get_by_tmdb_id(db, tmdb_id)
        if metadata is not None:
            film = film_repository.get_by_id(db, metadata.film_id)
            if film is not None:
                film_id = film.id
                status = film.status.value

        return TmdbFilmResponse(
            tmdb_id=details.tmdb_id,
            title=details.title,
            year=details.year,
            overview=details.overview,
            backdrop_url=TmdbClient.backdrop_url(details.backdrop_path),
            poster_url=TmdbClient.poster_url(details.poster_path),
            genres=list(details.genres),
            runtime=details.runtime,
            director=details.director,
            tmdb_rating=details.vote_average,
            trailer_url=TmdbClient.youtube_url(chosen.key) if chosen is not None else None,
            film_id=film_id,
            status=status,
        )
