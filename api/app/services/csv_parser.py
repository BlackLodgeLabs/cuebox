"""Letterboxd watchlist CSV parsing and validation."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.exceptions import AppError
from app.schemas.errors import ErrorCode

REQUIRED_COLUMNS = ("Date", "Year", "Letterboxd URI")
TITLE_COLUMNS = ("Title", "Name")
MAX_FILMS = 500


@dataclass(frozen=True)
class ParsedWatchlistRow:
    date: str
    title: str
    year: int | None
    letterboxd_uri: str


@dataclass(frozen=True)
class ParsedWatchlist:
    rows: list[ParsedWatchlistRow]
    in_file_duplicates: int


def _invalid_csv(message: str) -> AppError:
    return AppError(
        code=ErrorCode.INVALID_CSV_FORMAT,
        message=message,
        status_code=400,
    )


def _watchlist_exceeded() -> AppError:
    return AppError(
        code=ErrorCode.WATCHLIST_SIZE_EXCEEDED,
        message="CSV contains more than 500 films",
        status_code=400,
    )


def _parse_year(raw: str) -> int | None:
    value = raw.strip()
    if not value:
        return None
    if not value.isdigit() or len(value) != 4:
        raise _invalid_csv(f"Invalid year value: {raw!r}")
    year = int(value)
    max_year = datetime.now(UTC).year + 2
    if year < 1880 or year > max_year:
        raise _invalid_csv(f"Year out of range: {year}")
    return year


def parse_watchlist_csv(content: bytes) -> ParsedWatchlist:
    if not content:
        raise AppError(
            code=ErrorCode.VALIDATION_ERROR,
            message="Uploaded file is empty",
            status_code=400,
        )

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise _invalid_csv("File is not valid UTF-8 CSV") from exc

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise _invalid_csv("CSV has no header row")

    missing = [col for col in REQUIRED_COLUMNS if col not in reader.fieldnames]
    if missing:
        raise _invalid_csv(f"Missing required columns: {', '.join(missing)}")

    if not any(col in reader.fieldnames for col in TITLE_COLUMNS):
        raise _invalid_csv("Missing required columns: Title or Name")

    seen_uris: set[str] = set()
    rows: list[ParsedWatchlistRow] = []
    in_file_duplicates = 0

    for line_number, row in enumerate(reader, start=2):
        uri = (row.get("Letterboxd URI") or "").strip()
        if not uri:
            raise _invalid_csv(f"Empty Letterboxd URI on row {line_number}")

        if uri in seen_uris:
            in_file_duplicates += 1
            continue
        seen_uris.add(uri)

        title = (row.get("Title") or "").strip() or (row.get("Name") or "").strip()
        if not title:
            raise _invalid_csv(f"Empty title on row {line_number}")

        year = _parse_year(row.get("Year") or "")
        rows.append(
            ParsedWatchlistRow(
                date=(row.get("Date") or "").strip(),
                title=title,
                year=year,
                letterboxd_uri=uri,
            )
        )

    if len(rows) > MAX_FILMS:
        raise _watchlist_exceeded()

    return ParsedWatchlist(rows=rows, in_file_duplicates=in_file_duplicates)
