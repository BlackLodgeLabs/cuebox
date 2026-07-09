"""Resolve TMDB IDs to Letterboxd film URIs via public redirect."""

from __future__ import annotations

import logging
import re

import httpx

from app.services.letterboxd_uri import canonical_film_uri, extract_film_slug

logger = logging.getLogger(__name__)

_LETTERBOXD_TMDB_URL = "https://letterboxd.com/tmdb/{tmdb_id}"
_USER_AGENT = "Cuebox/1.0 (+https://github.com/BlackLodgeLabs/cuebox)"
_TIMEOUT_SECONDS = 10.0
_NON_FILM_PATHS = re.compile(r"/(member|list|actor|director|crew|films|watchlist)/", re.I)

_resolve_cache: dict[int, str] = {}


def _is_film_url(url: str) -> bool:
    if _NON_FILM_PATHS.search(url):
        return False
    return extract_film_slug(url) is not None


async def resolve_letterboxd_uri(
    tmdb_id: int,
    *,
    client: httpx.AsyncClient | None = None,
) -> str | None:
    """Follow Letterboxd TMDB shortcut and return canonical film URI, or None."""
    if tmdb_id in _resolve_cache:
        return _resolve_cache[tmdb_id]

    url = _LETTERBOXD_TMDB_URL.format(tmdb_id=tmdb_id)
    owns_client = client is None
    if owns_client:
        client = httpx.AsyncClient(
            follow_redirects=True,
            timeout=_TIMEOUT_SECONDS,
            headers={"User-Agent": _USER_AGENT},
        )

    try:
        response = await client.get(url)
        final_url = str(response.url)
        if response.status_code >= 400:
            logger.info(
                "Letterboxd redirect failed for TMDB %s: HTTP %s",
                tmdb_id,
                response.status_code,
            )
            return None
        if not _is_film_url(final_url):
            logger.info(
                "Letterboxd redirect for TMDB %s landed on non-film URL: %s",
                tmdb_id,
                final_url,
            )
            return None
        canonical = canonical_film_uri(final_url)
        _resolve_cache[tmdb_id] = canonical
        return canonical
    except httpx.HTTPError as exc:
        logger.warning("Letterboxd redirect request failed for TMDB %s: %s", tmdb_id, exc)
        return None
    finally:
        if owns_client:
            await client.aclose()


def clear_resolve_cache() -> None:
    """Clear in-process TMDB→Letterboxd cache (for tests)."""
    _resolve_cache.clear()
