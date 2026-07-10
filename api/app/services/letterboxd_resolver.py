"""Resolve TMDB IDs to Letterboxd film URIs via public redirect."""

from __future__ import annotations

import logging
import re
import unicodedata

import httpx

from app.services.letterboxd_uri import canonical_film_uri, extract_film_slug

logger = logging.getLogger(__name__)

_LETTERBOXD_TMDB_URL = "https://letterboxd.com/tmdb/{tmdb_id}"
_BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
_TIMEOUT_SECONDS = 10.0
_NON_FILM_PATHS = re.compile(r"/(member|list|actor|director|crew|films|watchlist)/", re.I)
_TMDB_ID_RE = re.compile(r'data-tmdb-id="(\d+)"')

_resolve_cache: dict[int, str] = {}


def _is_film_url(url: str) -> bool:
    if _NON_FILM_PATHS.search(url):
        return False
    return extract_film_slug(url) is not None


def slugify_title(title: str) -> str:
    """Approximate Letterboxd film slug from a TMDB title."""
    normalized = unicodedata.normalize("NFKD", title)
    ascii_title = normalized.encode("ascii", "ignore").decode("ascii")
    slug = ascii_title.lower()
    slug = re.sub(r"['’]", "", slug)
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def slug_candidates(
    title: str,
    *,
    year: int | None = None,
    original_title: str | None = None,
) -> list[str]:
    """Build likely Letterboxd film slugs for TMDB title/year."""
    seen: set[str] = set()
    candidates: list[str] = []

    def add(value: str) -> None:
        if value and value not in seen:
            seen.add(value)
            candidates.append(value)

    for raw_title in (title, original_title):
        if not raw_title:
            continue
        base = slugify_title(raw_title)
        add(base)
        if year is not None:
            add(f"{base}-{year}")

    return candidates


async def _resolve_via_tmdb_redirect(
    client: httpx.AsyncClient,
    tmdb_id: int,
) -> str | None:
    url = _LETTERBOXD_TMDB_URL.format(tmdb_id=tmdb_id)
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
    return canonical_film_uri(final_url)


async def _resolve_via_slug_probe(
    client: httpx.AsyncClient,
    tmdb_id: int,
    *,
    title: str,
    year: int | None,
    original_title: str | None,
) -> str | None:
    """Fallback when /tmdb/{id} is Cloudflare-blocked: probe /film/{slug}/ pages."""
    for slug in slug_candidates(title, year=year, original_title=original_title):
        film_url = f"https://letterboxd.com/film/{slug}/"
        try:
            response = await client.get(film_url)
        except httpx.HTTPError as exc:
            logger.debug("Slug probe failed for %s: %s", slug, exc)
            continue

        if response.status_code != 200:
            continue

        match = _TMDB_ID_RE.search(response.text)
        if match is None:
            continue
        if int(match.group(1)) != tmdb_id:
            continue

        canonical = canonical_film_uri(film_url)
        logger.info(
            "Resolved TMDB %s to %s via slug probe (%s)",
            tmdb_id,
            canonical,
            slug,
        )
        return canonical

    return None


async def resolve_letterboxd_uri(
    tmdb_id: int,
    *,
    title: str | None = None,
    year: int | None = None,
    original_title: str | None = None,
    client: httpx.AsyncClient | None = None,
) -> str | None:
    """Resolve a TMDB movie id to a canonical Letterboxd film URI."""
    if tmdb_id in _resolve_cache:
        return _resolve_cache[tmdb_id]

    owns_client = client is None
    if owns_client:
        client = httpx.AsyncClient(
            follow_redirects=True,
            timeout=_TIMEOUT_SECONDS,
            headers={"User-Agent": _BROWSER_USER_AGENT},
        )

    try:
        uri = await _resolve_via_tmdb_redirect(client, tmdb_id)
        if uri is None and title:
            uri = await _resolve_via_slug_probe(
                client,
                tmdb_id,
                title=title,
                year=year,
                original_title=original_title,
            )
        if uri is not None:
            _resolve_cache[tmdb_id] = uri
        return uri
    except httpx.HTTPError as exc:
        logger.warning("Letterboxd resolve request failed for TMDB %s: %s", tmdb_id, exc)
        return None
    finally:
        if owns_client:
            await client.aclose()


def clear_resolve_cache() -> None:
    """Clear in-process TMDB→Letterboxd cache (for tests)."""
    _resolve_cache.clear()
