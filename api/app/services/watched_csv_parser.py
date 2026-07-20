"""Parse and merge Letterboxd watched / ratings / diary CSV exports."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import date

from app.core.exceptions import AppError
from app.schemas.errors import ErrorCode
from app.services.rss_parser import normalize_member_rating

DEFAULT_WATCHED_AT = date(1984, 9, 28)

WATCHED_REQUIRED = ("Date", "Name", "Year", "Letterboxd URI")
RATINGS_REQUIRED = ("Date", "Name", "Year", "Letterboxd URI", "Rating")
DIARY_REQUIRED = ("Date", "Name", "Year", "Letterboxd URI", "Watched Date")


@dataclass(frozen=True)
class WatchEventPlan:
    watched_at: date
    score: float | None
    completed: bool


@dataclass(frozen=True)
class FilmImportPlan:
    title: str
    year: int | None
    letterboxd_uri: str
    events: list[WatchEventPlan] = field(default_factory=list)

    @property
    def needs_pending_review(self) -> bool:
        return any(not event.completed for event in self.events)


def _invalid_csv(message: str) -> AppError:
    return AppError(
        code=ErrorCode.INVALID_CSV_FORMAT,
        message=message,
        status_code=400,
    )


def _decode_csv(content: bytes, label: str) -> csv.DictReader:
    if not content:
        raise AppError(
            code=ErrorCode.VALIDATION_ERROR,
            message=f"{label} file is empty",
            status_code=400,
        )
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise _invalid_csv(f"{label} is not valid UTF-8 CSV") from exc

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise _invalid_csv(f"{label} has no header row")
    return reader


def _require_columns(reader: csv.DictReader, required: tuple[str, ...], label: str) -> None:
    missing = [col for col in required if col not in (reader.fieldnames or [])]
    if missing:
        raise _invalid_csv(f"{label} missing required columns: {', '.join(missing)}")


def _parse_year(raw: str, *, label: str, line_number: int) -> int | None:
    value = raw.strip()
    if not value:
        return None
    if not value.isdigit() or len(value) != 4:
        raise _invalid_csv(f"{label} invalid year on row {line_number}: {raw!r}")
    return int(value)


def _parse_iso_date(raw: str, *, label: str, line_number: int, field_name: str) -> date:
    value = raw.strip()
    if not value:
        raise _invalid_csv(f"{label} empty {field_name} on row {line_number}")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise _invalid_csv(
            f"{label} invalid {field_name} on row {line_number}: {raw!r}"
        ) from exc


def _row_key(name: str, year: str) -> tuple[str, str]:
    return (name.strip(), year.strip())


def parse_watched_csv(content: bytes) -> list[dict]:
    reader = _decode_csv(content, "watched.csv")
    _require_columns(reader, WATCHED_REQUIRED, "watched.csv")
    rows: list[dict] = []
    for line_number, row in enumerate(reader, start=2):
        name = (row.get("Name") or "").strip()
        if not name:
            raise _invalid_csv(f"watched.csv empty Name on row {line_number}")
        uri = (row.get("Letterboxd URI") or "").strip()
        if not uri:
            raise _invalid_csv(f"watched.csv empty Letterboxd URI on row {line_number}")
        year = _parse_year(row.get("Year") or "", label="watched.csv", line_number=line_number)
        rows.append(
            {
                "name": name,
                "year": year,
                "year_raw": (row.get("Year") or "").strip(),
                "letterboxd_uri": uri,
            }
        )
    if not rows:
        raise _invalid_csv("watched.csv has no data rows")
    return rows


def parse_ratings_csv(content: bytes) -> dict[tuple[str, str], float]:
    reader = _decode_csv(content, "ratings.csv")
    _require_columns(reader, RATINGS_REQUIRED, "ratings.csv")
    ratings: dict[tuple[str, str], float] = {}
    for line_number, row in enumerate(reader, start=2):
        name = (row.get("Name") or "").strip()
        year_raw = (row.get("Year") or "").strip()
        if not name:
            raise _invalid_csv(f"ratings.csv empty Name on row {line_number}")
        _parse_year(year_raw, label="ratings.csv", line_number=line_number)
        raw_rating = (row.get("Rating") or "").strip()
        if not raw_rating:
            continue
        score = normalize_member_rating(raw_rating)
        if score is None:
            raise _invalid_csv(f"ratings.csv invalid Rating on row {line_number}: {raw_rating!r}")
        ratings[_row_key(name, year_raw)] = score
    return ratings


def parse_diary_csv(content: bytes) -> dict[tuple[str, str], list[date]]:
    reader = _decode_csv(content, "diary.csv")
    _require_columns(reader, DIARY_REQUIRED, "diary.csv")
    diary: dict[tuple[str, str], list[date]] = {}
    for line_number, row in enumerate(reader, start=2):
        name = (row.get("Name") or "").strip()
        year_raw = (row.get("Year") or "").strip()
        if not name:
            raise _invalid_csv(f"diary.csv empty Name on row {line_number}")
        _parse_year(year_raw, label="diary.csv", line_number=line_number)
        watched_at = _parse_iso_date(
            row.get("Watched Date") or "",
            label="diary.csv",
            line_number=line_number,
            field_name="Watched Date",
        )
        diary.setdefault(_row_key(name, year_raw), []).append(watched_at)
    return diary


def merge_watched_exports(
    watched_bytes: bytes,
    ratings_bytes: bytes,
    diary_bytes: bytes,
) -> list[FilmImportPlan]:
    """Merge three Letterboxd exports into per-film watch event plans."""
    watched_rows = parse_watched_csv(watched_bytes)
    ratings_by = parse_ratings_csv(ratings_bytes)
    diary_by = parse_diary_csv(diary_bytes)

    plans: list[FilmImportPlan] = []
    for row in watched_rows:
        key = _row_key(row["name"], row["year_raw"])
        rating = ratings_by.get(key)
        diary_dates = diary_by.get(key, [])

        if not diary_dates:
            events = [
                WatchEventPlan(
                    watched_at=DEFAULT_WATCHED_AT,
                    score=rating,
                    completed=True,
                )
            ]
        else:
            events = [
                WatchEventPlan(
                    watched_at=watched_at,
                    score=rating,
                    completed=rating is not None,
                )
                for watched_at in diary_dates
            ]

        plans.append(
            FilmImportPlan(
                title=row["name"],
                year=row["year"],
                letterboxd_uri=row["letterboxd_uri"],
                events=events,
            )
        )
    return plans
