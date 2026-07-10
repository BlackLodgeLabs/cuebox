"""Letterboxd URI normalization and film matching helpers."""

from __future__ import annotations

import re

import httpx

from app.core.exceptions import validation_error

_FILM_SLUG_RE = re.compile(r"/film/([^/?#]+)/?")
_BOXD_IT_RE = re.compile(r"^https?://boxd\.it/", re.I)
_USER_AGENT = "Cuebox/1.0 (+https://github.com/BlackLodgeLabs/cuebox)"
_TIMEOUT_SECONDS = 10.0


def canonical_film_uri(uri: str) -> str:
    """Normalize Letterboxd film URLs to https://letterboxd.com/film/{slug}/."""
    slug = extract_film_slug(uri)
    if slug is None:
        return uri
    return f"https://letterboxd.com/film/{slug}/"


def extract_film_slug(uri: str) -> str | None:
    match = _FILM_SLUG_RE.search(uri)
    if match is None:
        return None
    return match.group(1)


async def normalize_pasted_uri(
    uri: str,
    *,
    client: httpx.AsyncClient | None = None,
) -> str:
    """Validate and normalize a user-pasted Letterboxd film URL or boxd.it short link."""
    trimmed = uri.strip()
    if not trimmed:
        raise validation_error("Letterboxd URL is required")

    if _BOXD_IT_RE.match(trimmed):
        owns_client = client is None
        if owns_client:
            client = httpx.AsyncClient(
                follow_redirects=True,
                timeout=_TIMEOUT_SECONDS,
                headers={"User-Agent": _USER_AGENT},
            )
        try:
            response = await client.get(trimmed)
            final_url = str(response.url)
        except httpx.HTTPError as exc:
            raise validation_error(f"Could not resolve short link: {exc}") from exc
        finally:
            if owns_client:
                await client.aclose()
        slug = extract_film_slug(final_url)
        if slug is None:
            raise validation_error("Short link did not resolve to a Letterboxd film page")
        return canonical_film_uri(final_url)

    slug = extract_film_slug(trimmed)
    if slug is None:
        raise validation_error(
            "Invalid Letterboxd URL. Paste a film page URL (letterboxd.com/film/...) or boxd.it link."
        )
    return canonical_film_uri(trimmed)
