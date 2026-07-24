"""Unit tests for Letterboxd watched/ratings/diary CSV merge."""

from datetime import date
from pathlib import Path

import pytest

from app.core.exceptions import AppError
from app.schemas.errors import ErrorCode
from app.services.watched_csv_parser import (
    DEFAULT_WATCHED_AT,
    merge_watched_exports,
    parse_diary_csv,
    parse_ratings_csv,
    parse_watched_csv,
)

FIXTURES = Path(__file__).parent / "fixtures" / "watched_import"


def _load(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def test_parser_rejects_missing_headers():
    with pytest.raises(AppError) as exc:
        parse_watched_csv(b"Name,Year\nFoo,2020\n")
    assert exc.value.code == ErrorCode.INVALID_CSV_FORMAT


def test_parser_rejects_empty_file():
    with pytest.raises(AppError) as exc:
        parse_ratings_csv(b"")
    assert exc.value.code == ErrorCode.VALIDATION_ERROR


def test_merge_watched_only_default_date_null_score():
    plans = merge_watched_exports(_load("watched.csv"), _load("ratings.csv"), _load("diary.csv"))
    by_title = {p.title: p for p in plans}

    slave = by_title["12 Years a Slave"]
    assert len(slave.events) == 1
    assert slave.events[0].watched_at == DEFAULT_WATCHED_AT
    assert slave.events[0].score is None
    assert slave.events[0].completed is True

    odyssey = by_title["2001: A Space Odyssey"]
    assert odyssey.events[0].watched_at == DEFAULT_WATCHED_AT
    assert odyssey.events[0].score is None
    assert odyssey.events[0].completed is True


def test_merge_rated_no_diary_uses_score_and_default_date():
    plans = merge_watched_exports(_load("watched.csv"), _load("ratings.csv"), _load("diary.csv"))
    hellraiser = next(p for p in plans if p.title == "Hellraiser")
    assert len(hellraiser.events) == 1
    assert hellraiser.events[0].watched_at == DEFAULT_WATCHED_AT
    assert hellraiser.events[0].score == 5.0
    assert hellraiser.events[0].completed is True


def test_merge_uses_watched_date_not_date():
    plans = merge_watched_exports(_load("watched.csv"), _load("ratings.csv"), _load("diary.csv"))
    by_title = {p.title: p for p in plans}

    love = by_title["Love Lies Bleeding"]
    assert love.events[0].watched_at == date(2024, 6, 13)
    assert love.events[0].score == 5.0

    lady = by_title["The Lady Vanishes"]
    assert lady.events[0].watched_at == date(2023, 12, 31)
    assert lady.events[0].score == 4.0


def test_merge_multi_diary_expands_events():
    plans = merge_watched_exports(_load("watched.csv"), _load("ratings.csv"), _load("diary.csv"))
    kneecap = next(p for p in plans if p.title == "Kneecap")
    assert len(kneecap.events) == 2
    assert {e.watched_at for e in kneecap.events} == {
        date(2024, 11, 3),
        date(2026, 2, 25),
    }
    assert all(e.score == 5.0 and e.completed for e in kneecap.events)

    groundhog = next(p for p in plans if p.title == "Groundhog Day")
    assert len(groundhog.events) == 1
    assert groundhog.events[0].watched_at == date(2024, 2, 7)
    assert groundhog.events[0].score == 5.0


def test_merge_diary_no_rating_pending():
    plans = merge_watched_exports(_load("watched.csv"), _load("ratings.csv"), _load("diary.csv"))
    seven = next(p for p in plans if p.title == "Seven Samurai")
    assert seven.needs_pending_review is True
    assert len(seven.events) == 1
    assert seven.events[0].watched_at == date(2023, 12, 31)
    assert seven.events[0].score is None
    assert seven.events[0].completed is False


def test_parse_diary_ignores_date_column_for_watched_at():
    diary = parse_diary_csv(_load("diary.csv"))
    love_dates = diary[("Love Lies Bleeding", "2024")]
    assert love_dates == [date(2024, 6, 13)]


def test_parse_ratings_skips_empty_rating():
    content = (
        b"Date,Name,Year,Letterboxd URI,Rating\n"
        b"2024-01-01,Empty Score,2020,https://boxd.it/abc,\n"
        b"2024-01-01,Has Score,2021,https://boxd.it/def,4\n"
    )
    ratings = parse_ratings_csv(content)
    assert ("Empty Score", "2020") not in ratings
    assert ratings[("Has Score", "2021")] == 4.0
