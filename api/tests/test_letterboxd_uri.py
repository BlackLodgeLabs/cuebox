"""Tests for Letterboxd URI normalization."""

from app.services.letterboxd_uri import canonical_film_uri, extract_film_slug


def test_extract_film_slug_from_username_prefixed_url():
    uri = "https://letterboxd.com/hastiecraig/film/the-long-walk-2025/"
    assert extract_film_slug(uri) == "the-long-walk-2025"


def test_canonical_film_uri_strips_username():
    uri = "https://letterboxd.com/hastiecraig/film/the-long-walk-2025/"
    assert canonical_film_uri(uri) == "https://letterboxd.com/film/the-long-walk-2025/"


def test_canonical_film_uri_leaves_canonical_unchanged():
    uri = "https://letterboxd.com/film/stalker/"
    assert canonical_film_uri(uri) == uri


def test_extract_film_slug_returns_none_for_short_url():
    assert extract_film_slug("https://boxd.it/mic8") is None
