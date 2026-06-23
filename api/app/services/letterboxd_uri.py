"""Letterboxd URI normalization and film matching helpers."""

from __future__ import annotations

import re

_FILM_SLUG_RE = re.compile(r"/film/([^/?#]+)/?")


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
