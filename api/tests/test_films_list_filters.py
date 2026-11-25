"""GET /films runtime and rating sorts, genre and runtime filters, summary fields."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.database.enums import EnrichmentStatus, FilmStatus, WatchSource
from app.database.session import SessionLocal
from app.repositories import (
    film_metadata_repository,
    film_repository,
    film_watch_repository,
    import_job_repository,
    watchlist_repository,
)
from tests.conftest import requires_db

pytestmark = requires_db


def _seed_film(
    db: Session,
    *,
    title: str,
    year: int = 2001,
    status: FilmStatus = FilmStatus.ACTIVE,
    on_watchlist: bool = False,
    include_metadata: bool = True,
    runtime: int | None = 100,
    genres: list[str] | None = None,
    tmdb_rating: float | None = None,
    letterboxd_rating: float | None = None,
    backdrop_url: str | None = None,
) -> str:
    suffix = uuid.uuid4().hex[:8]
    job = import_job_repository.create(db, total_films=1)
    film = film_repository.create(
        db,
        title=title,
        letterboxd_uri=f"https://letterboxd.com/film/{suffix}/",
        year=year,
        import_job_id=job.id,
    )
    film.status = status
    film.enrichment_status = EnrichmentStatus.READY
    if include_metadata:
        film_metadata_repository.upsert(
            db,
            film.id,
            tmdb_id=uuid.uuid4().int % 1_000_000_000,
            runtime=runtime,
            genres=genres if genres is not None else ["Drama"],
            tmdb_rating=Decimal(str(tmdb_rating)) if tmdb_rating is not None else None,
            letterboxd_rating=(
                Decimal(str(letterboxd_rating)) if letterboxd_rating is not None else None
            ),
            backdrop_url=backdrop_url,
            poster_url="https://image.tmdb.org/t/p/w500/poster.jpg",
            director="Test Director",
        )
    if on_watchlist:
        watchlist_repository.create_active_entry(
            db,
            film_id=film.id,
            letterboxd_uri=film.letterboxd_uri,
        )
    db.commit()
    return str(film.id)


def _add_watch(
    db: Session,
    film_id: str,
    *,
    score: float | None,
    watched_at: date,
    pending: bool = False,
    created_at: datetime | None = None,
) -> None:
    if pending:
        watch = film_watch_repository.create_pending(
            db,
            film_id=uuid.UUID(film_id),
            source=WatchSource.MANUAL,
            watched_at=watched_at,
            score=score,
        )
    else:
        watch = film_watch_repository.create_completed(
            db,
            film_id=uuid.UUID(film_id),
            source=WatchSource.MANUAL,
            watched_at=watched_at,
            score=score,
        )
    if created_at is not None:
        watch.created_at = created_at
    db.commit()


def _titles(response) -> list[str]:
    assert response.status_code == 200, response.text
    return [item["title"] for item in response.json()["data"]]


def test_sort_runtime_both_directions_nulls_last_title_then_id(integration_client):
    """Shortest or longest first. Null runtimes stay last. Ties break by title, then id."""
    with SessionLocal() as db:
        long_id = _seed_film(db, title="Longest", runtime=180)
        alpha_a = _seed_film(db, title="Alpha", runtime=100)
        alpha_b = _seed_film(db, title="Alpha", runtime=100)
        bravo_id = _seed_film(db, title="Bravo", runtime=100)
        missing_id = _seed_film(db, title="Missing Runtime", include_metadata=False)
        null_runtime_id = _seed_film(db, title="Null Runtime", runtime=None)

    tied = [*sorted([alpha_a, alpha_b]), bravo_id]
    # Missing Runtime sorts ahead of Null Runtime by title; both are null runtime.
    nulls = [missing_id, null_runtime_id]

    asc = integration_client.get("/api/v1/films?sort=runtime&sort_dir=asc&limit=20")
    assert asc.status_code == 200, asc.text
    assert [item["id"] for item in asc.json()["data"]] == [*tied, long_id, *nulls]

    desc = integration_client.get("/api/v1/films?sort=runtime&sort_dir=desc&limit=20")
    assert desc.status_code == 200, desc.text
    assert [item["id"] for item in desc.json()["data"]] == [long_id, *tied, *nulls]


def test_invalid_sort_lists_runtime_and_rating(integration_client):
    response = integration_client.get("/api/v1/films?sort=poster")
    assert response.status_code == 400
    message = response.json()["error"]["message"]
    assert "runtime" in message
    assert "rating" in message


def test_sort_rating_uses_tmdb_on_watched_not_own_score(integration_client):
    """Watched rating sort is TMDB. Own stars and Letterboxd scores do not reorder it."""
    with SessionLocal() as db:
        alpha = _seed_film(
            db,
            title="Alpha",
            status=FilmStatus.WATCHED,
            tmdb_rating=9.0,
            letterboxd_rating=1.0,
        )
        bravo = _seed_film(
            db,
            title="Bravo",
            status=FilmStatus.WATCHED,
            tmdb_rating=9.0,
            letterboxd_rating=1.0,
        )
        low = _seed_film(
            db,
            title="Low",
            status=FilmStatus.WATCHED,
            tmdb_rating=6.0,
            letterboxd_rating=5.0,
        )
        missing = _seed_film(
            db,
            title="Missing",
            status=FilmStatus.WATCHED,
            tmdb_rating=None,
            letterboxd_rating=5.0,
        )
        _add_watch(db, alpha, score=1.0, watched_at=date(2024, 6, 1))
        _add_watch(db, bravo, score=5.0, watched_at=date(2024, 6, 1))
        _add_watch(db, low, score=5.0, watched_at=date(2024, 6, 1))
        _add_watch(db, missing, score=5.0, watched_at=date(2024, 6, 1))

    desc = integration_client.get(
        "/api/v1/films?status=watched&sort=rating&sort_dir=desc&limit=20"
    )
    assert desc.status_code == 200, desc.text
    assert [item["id"] for item in desc.json()["data"]] == [alpha, bravo, low, missing]

    asc = integration_client.get(
        "/api/v1/films?status=watched&sort=rating&sort_dir=asc&limit=20"
    )
    assert asc.status_code == 200, asc.text
    assert [item["id"] for item in asc.json()["data"]] == [low, alpha, bravo, missing]


def test_genres_and_runtime_limit_combine_with_status_search_and_sort(integration_client):
    """Any-of genres plus a runtime ceiling, and pagination.total follows both."""
    with SessionLocal() as db:
        short = _seed_film(
            db,
            title="Pick Short",
            status=FilmStatus.ACTIVE,
            runtime=80,
            genres=["Horror"],
        )
        folk = _seed_film(
            db,
            title="Pick Folk",
            status=FilmStatus.ACTIVE,
            runtime=110,
            genres=["Folk horror"],
        )
        at_ceiling = _seed_film(
            db,
            title="Pick Ceiling",
            status=FilmStatus.ACTIVE,
            runtime=120,
            genres=["Drama", "Horror"],
        )
        _seed_film(
            db,
            title="Pick Too Long",
            status=FilmStatus.ACTIVE,
            runtime=121,
            genres=["Horror"],
        )
        _seed_film(
            db,
            title="Pick Comedy",
            status=FilmStatus.ACTIVE,
            runtime=80,
            genres=["Comedy"],
        )
        _seed_film(
            db,
            title="Other Horror",
            status=FilmStatus.ACTIVE,
            runtime=90,
            genres=["Horror"],
        )
        _seed_film(
            db,
            title="Pick Null",
            status=FilmStatus.ACTIVE,
            runtime=None,
            genres=["Horror"],
        )
        _seed_film(
            db,
            title="Pick Watched",
            status=FilmStatus.WATCHED,
            runtime=70,
            genres=["Horror"],
        )

    query = (
        "/api/v1/films?status=active&search=pick&genres=Horror,Folk%20horror"
        "&runtime=le_120&sort=runtime&sort_dir=asc&limit=1"
    )
    response = integration_client.get(query)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["pagination"]["total"] == 3
    assert body["pagination"]["has_more"] is True
    assert [item["id"] for item in body["data"]] == [short]

    page_two = integration_client.get(query.replace("limit=1", "limit=10"))
    assert [item["id"] for item in page_two.json()["data"]] == [short, folk, at_ceiling]


def test_runtime_limit_ceilings_any_and_unknown(integration_client):
    with SessionLocal() as db:
        ninety = _seed_film(db, title="Ninety", runtime=90, genres=["Drama"])
        ninety_one = _seed_film(db, title="Ninety One", runtime=91, genres=["Drama"])
        one_twenty = _seed_film(db, title="One Twenty", runtime=120, genres=["Drama"])
        one_fifty = _seed_film(db, title="One Fifty", runtime=150, genres=["Drama"])
        one_fifty_one = _seed_film(db, title="One Fifty One", runtime=151, genres=["Drama"])
        null_runtime = _seed_film(db, title="No Runtime", runtime=None, genres=["Drama"])

    def ids_for(runtime: str | None) -> set[str]:
        url = "/api/v1/films?limit=20"
        if runtime is not None:
            url += f"&runtime={runtime}"
        response = integration_client.get(url)
        assert response.status_code == 200, response.text
        return {item["id"] for item in response.json()["data"]}

    assert ids_for("le_90") == {ninety}
    assert ids_for("le_120") == {ninety, ninety_one, one_twenty}
    assert ids_for("le_150") == {ninety, ninety_one, one_twenty, one_fifty}
    assert null_runtime in ids_for("any")
    assert one_fifty_one in ids_for("any")
    assert null_runtime in ids_for(None)
    assert one_fifty_one in ids_for(None)

    invalid = integration_client.get("/api/v1/films?runtime=short")
    assert invalid.status_code == 400
    assert invalid.json()["error"]["code"] == "VALIDATION_ERROR"


def test_watchlist_genres_are_distinct_and_case_insensitive(integration_client):
    with SessionLocal() as db:
        _seed_film(
            db,
            title="On List",
            on_watchlist=True,
            genres=["Horror", "Drama"],
        )
        _seed_film(
            db,
            title="Also On List",
            on_watchlist=True,
            genres=["horror", "Folk horror"],
        )
        _seed_film(db, title="Not On List", on_watchlist=False, genres=["Comedy"])

    response = integration_client.get("/api/v1/films/genres")
    assert response.status_code == 200, response.text
    assert response.json()["data"] == ["Drama", "Folk horror", "Horror"]


def test_film_summary_includes_backdrop_and_latest_rated_score(integration_client):
    with SessionLocal() as db:
        rated = _seed_film(
            db,
            title="Rated",
            backdrop_url="https://image.tmdb.org/t/p/w1280/rated.jpg",
        )
        _add_watch(db, rated, score=2.0, watched_at=date(2020, 1, 1))
        _add_watch(db, rated, score=4.5, watched_at=date(2024, 6, 1))
        _add_watch(db, rated, score=5.0, watched_at=date(2024, 12, 1), pending=True)
        bare = _seed_film(
            db,
            title="Bare",
            include_metadata=False,
        )

    response = integration_client.get("/api/v1/films?sort=title&sort_dir=asc&limit=20")
    assert response.status_code == 200, response.text
    by_id = {item["id"]: item for item in response.json()["data"]}
    assert by_id[rated]["backdrop_url"] == "https://image.tmdb.org/t/p/w1280/rated.jpg"
    assert by_id[rated]["latest_score"] == 4.5
    assert by_id[bare]["backdrop_url"] is None
    assert by_id[bare]["latest_score"] is None


def test_recommendation_film_result_includes_backdrop_and_genres(integration_client):
    from app.database.models import FilmMetadata
    from tests.helpers.seed_ready_films import DEFAULT_QUESTIONNAIRE, seed_ready_films

    with SessionLocal() as db:
        films = seed_ready_films(db, count=5)
        for film in films:
            metadata = db.get(FilmMetadata, film.id)
            assert metadata is not None
            metadata.backdrop_url = "https://image.tmdb.org/t/p/w1280/seed-backdrop.jpg"
        db.commit()

    created = integration_client.post(
        "/api/v1/recommendations",
        json={"questionnaire": DEFAULT_QUESTIONNAIRE, "notes": "Slow burn horror"},
    )
    assert created.status_code == 200, created.text
    body = created.json()
    for film in [body["winner"], *body["runners_up"]]:
        assert film["backdrop_url"] == "https://image.tmdb.org/t/p/w1280/seed-backdrop.jpg"
        assert film["genres"] == ["Horror", "Drama"]

    detail = integration_client.get(f"/api/v1/recommendations/{body['session_id']}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["winner"]["backdrop_url"] == body["winner"]["backdrop_url"]
    assert detail.json()["winner"]["genres"] == ["Horror", "Drama"]
