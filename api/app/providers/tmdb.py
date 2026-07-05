"""TMDB API v3 client."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.providers.http_retry import request_with_retry

TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w780"
TMDB_SEARCH_PAGE_SIZE = 20


@dataclass(frozen=True)
class TmdbSearchResult:
    tmdb_id: int
    title: str
    original_title: str
    year: int | None
    overview: str | None
    poster_path: str | None


@dataclass(frozen=True)
class TmdbSearchPage:
    results: list[TmdbSearchResult]
    page: int
    total_pages: int
    total_results: int


@dataclass(frozen=True)
class TmdbWatchProviderEntry:
    provider_id: int
    provider_name: str
    logo_path: str | None
    display_priority: int


@dataclass(frozen=True)
class TmdbWatchProvidersResult:
    link: str | None
    flatrate: list[TmdbWatchProviderEntry]
    rent: list[TmdbWatchProviderEntry]
    buy: list[TmdbWatchProviderEntry]
    ads: list[TmdbWatchProviderEntry]


@dataclass(frozen=True)
class TmdbMovieDetails:
    tmdb_id: int
    imdb_id: str | None
    title: str
    original_title: str
    year: int | None
    runtime: int | None
    overview: str | None
    genres: list[str]
    original_language: str | None
    country: str | None
    vote_average: float | None
    poster_path: str | None
    backdrop_path: str | None
    director: str | None


class TmdbClient:
    def __init__(self, client: httpx.AsyncClient, api_key: str) -> None:
        self._client = client
        self._api_key = api_key

    async def search_movie(
        self,
        title: str,
        *,
        year: int | None = None,
        page: int = 1,
    ) -> TmdbSearchPage:
        params: dict[str, Any] = {
            "api_key": self._api_key,
            "query": title,
            "page": page,
        }
        if year is not None:
            params["year"] = year
        response = await request_with_retry(
            self._client,
            "GET",
            f"{TMDB_BASE_URL}/search/movie",
            params=params,
        )
        response.raise_for_status()
        payload = response.json()
        results = payload.get("results", [])
        parsed: list[TmdbSearchResult] = []
        for item in results:
            release = item.get("release_date") or ""
            year_prefix = release[:4]
            parsed_year = int(year_prefix) if len(year_prefix) == 4 and year_prefix.isdigit() else None
            parsed.append(
                TmdbSearchResult(
                    tmdb_id=item["id"],
                    title=item.get("title") or "",
                    original_title=item.get("original_title") or "",
                    year=parsed_year,
                    overview=item.get("overview"),
                    poster_path=item.get("poster_path"),
                )
            )
        return TmdbSearchPage(
            results=parsed,
            page=payload.get("page", page),
            total_pages=payload.get("total_pages", 1),
            total_results=payload.get("total_results", len(parsed)),
        )

    async def get_movie_details(self, tmdb_id: int) -> TmdbMovieDetails:
        response = await request_with_retry(
            self._client,
            "GET",
            f"{TMDB_BASE_URL}/movie/{tmdb_id}",
            params={"api_key": self._api_key},
        )
        response.raise_for_status()
        data = response.json()
        credits = await self.get_movie_credits(tmdb_id)
        genres = [g["name"] for g in data.get("genres", []) if g.get("name")]
        release = data.get("release_date") or ""
        year_prefix = release[:4]
        year = int(year_prefix) if len(year_prefix) == 4 and year_prefix.isdigit() else None
        countries = data.get("production_countries") or []
        country = countries[0].get("iso_3166_1") if countries else None
        return TmdbMovieDetails(
            tmdb_id=data["id"],
            imdb_id=data.get("imdb_id"),
            title=data.get("title") or "",
            original_title=data.get("original_title") or "",
            year=year,
            # TMDB returns 0 when runtime is unknown; normalize to None to satisfy DB constraint
            runtime=(data.get("runtime") or None),
            overview=data.get("overview"),
            genres=genres,
            original_language=(data.get("original_language") or "")[:2] or None,
            country=country,
            vote_average=data.get("vote_average"),
            poster_path=data.get("poster_path"),
            backdrop_path=data.get("backdrop_path"),
            director=credits,
        )

    async def get_movie_keywords(self, tmdb_id: int) -> list[str]:
        response = await request_with_retry(
            self._client,
            "GET",
            f"{TMDB_BASE_URL}/movie/{tmdb_id}/keywords",
            params={"api_key": self._api_key},
        )
        response.raise_for_status()
        keywords = response.json().get("keywords", [])
        return [k["name"] for k in keywords if k.get("name")]

    async def get_movie_credits(self, tmdb_id: int) -> str | None:
        response = await request_with_retry(
            self._client,
            "GET",
            f"{TMDB_BASE_URL}/movie/{tmdb_id}/credits",
            params={"api_key": self._api_key},
        )
        response.raise_for_status()
        crew = response.json().get("crew", [])
        directors = [c["name"] for c in crew if c.get("job") == "Director" and c.get("name")]
        return directors[0] if directors else None

    async def get_movie_watch_providers(
        self,
        tmdb_id: int,
        *,
        country_code: str = "GB",
    ) -> TmdbWatchProvidersResult:
        response = await request_with_retry(
            self._client,
            "GET",
            f"{TMDB_BASE_URL}/movie/{tmdb_id}/watch/providers",
            params={"api_key": self._api_key},
        )
        response.raise_for_status()
        payload = response.json()
        country = payload.get("results", {}).get(country_code) or {}

        def _parse_entries(key: str) -> list[TmdbWatchProviderEntry]:
            entries = country.get(key) or []
            parsed: list[TmdbWatchProviderEntry] = []
            for item in entries:
                if not isinstance(item, dict):
                    continue
                provider_id = item.get("provider_id")
                provider_name = item.get("provider_name")
                if provider_id is None or not provider_name:
                    continue
                parsed.append(
                    TmdbWatchProviderEntry(
                        provider_id=int(provider_id),
                        provider_name=str(provider_name),
                        logo_path=item.get("logo_path"),
                        display_priority=int(item.get("display_priority") or 0),
                    )
                )
            return parsed

        return TmdbWatchProvidersResult(
            link=country.get("link"),
            flatrate=_parse_entries("flatrate"),
            rent=_parse_entries("rent"),
            buy=_parse_entries("buy"),
            ads=_parse_entries("ads"),
        )

    @staticmethod
    def poster_url(path: str | None) -> str | None:
        return f"{TMDB_IMAGE_BASE}{path}" if path else None

    @staticmethod
    def backdrop_url(path: str | None) -> str | None:
        return f"{TMDB_BACKDROP_BASE}{path}" if path else None

    @staticmethod
    def provider_logo_url(path: str | None, size: str = "w92") -> str | None:
        if not path:
            return None
        return f"https://image.tmdb.org/t/p/{size}{path}"
