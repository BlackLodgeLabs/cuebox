"""CSV parser unit tests."""

import pytest

from app.core.exceptions import AppError
from app.schemas.errors import ErrorCode
from app.services.csv_parser import parse_watchlist_csv

VALID_HEADER = "Date,Title,Year,Letterboxd URI\n"


def _csv(*rows: str) -> bytes:
    return (VALID_HEADER + "\n".join(rows)).encode()


def test_parse_valid_csv():
    content = _csv(
        "2024-01-01,The Matrix,1999,https://letterboxd.com/film/the-matrix/",
        "2024-01-02,Inception,2010,https://letterboxd.com/film/inception/",
    )
    result = parse_watchlist_csv(content)
    assert len(result.rows) == 2
    assert result.in_file_duplicates == 0
    assert result.rows[0].title == "The Matrix"
    assert result.rows[0].year == 1999


def test_missing_columns():
    content = b"Title,Year\nFoo,2000\n"
    with pytest.raises(AppError) as exc:
        parse_watchlist_csv(content)
    assert exc.value.code == ErrorCode.INVALID_CSV_FORMAT


def test_invalid_year():
    content = _csv("2024-01-01,Bad Film,99,https://letterboxd.com/film/bad/")
    with pytest.raises(AppError) as exc:
        parse_watchlist_csv(content)
    assert exc.value.code == ErrorCode.INVALID_CSV_FORMAT


def test_watchlist_size_exceeded():
    rows = [
        f"2024-01-01,Film {i},2000,https://letterboxd.com/film/film-{i}/"
        for i in range(501)
    ]
    with pytest.raises(AppError) as exc:
        parse_watchlist_csv(_csv(*rows))
    assert exc.value.code == ErrorCode.WATCHLIST_SIZE_EXCEEDED


def test_in_file_duplicate_uris():
    uri = "https://letterboxd.com/film/dup/"
    content = _csv(
        f"2024-01-01,First,2000,{uri}",
        f"2024-01-02,Second,2001,{uri}",
    )
    result = parse_watchlist_csv(content)
    assert len(result.rows) == 1
    assert result.in_file_duplicates == 1


def test_parse_csv_with_name_column():
    header = "Date,Name,Year,Letterboxd URI\n"
    content = (
        header
        + "2026-04-12,Exit 8,2025,https://boxd.it/S9Kk\n"
        + "2026-04-28,The Day the Earth Stood Still,1951,https://boxd.it/29w4\n"
    ).encode()
    result = parse_watchlist_csv(content)
    assert len(result.rows) == 2
    assert result.rows[0].title == "Exit 8"
    assert result.rows[1].year == 1951


def test_title_column_preferred_over_name():
    header = "Date,Title,Name,Year,Letterboxd URI\n"
    content = (
        header + "2024-01-01,Canonical Title,Alternate Name,2000,https://boxd.it/abc\n"
    ).encode()
    result = parse_watchlist_csv(content)
    assert result.rows[0].title == "Canonical Title"
