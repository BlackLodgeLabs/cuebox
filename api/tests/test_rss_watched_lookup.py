"""Tests for RSS watched film resolution."""

from app.repositories import film_repository, import_job_repository, watchlist_repository


def _create_film(db_session, *, title: str, letterboxd_uri: str, year: int | None):
    job = import_job_repository.create(db_session, total_films=1)
    return film_repository.create(
        db_session,
        title=title,
        letterboxd_uri=letterboxd_uri,
        year=year,
        import_job_id=job.id,
    )


def test_find_for_rss_watched_matches_boxd_it_uri_by_title_year(db_session):
    film = _create_film(
        db_session,
        title="The Long Walk",
        letterboxd_uri="https://boxd.it/mic8",
        year=2025,
    )
    watchlist_repository.create_active_entry(
        db_session,
        film_id=film.id,
        letterboxd_uri=film.letterboxd_uri,
    )
    db_session.commit()

    matched, strategy = film_repository.find_for_rss_watched(
        db_session,
        "https://letterboxd.com/hastiecraig/film/the-long-walk-2025/",
        title="The Long Walk",
        year=2025,
    )

    assert matched is not None
    assert matched.id == film.id
    assert strategy == "title_year"


def test_find_for_rss_watched_matches_canonical_uri(db_session):
    film = _create_film(
        db_session,
        title="Stalker",
        letterboxd_uri="https://letterboxd.com/film/stalker/",
        year=1979,
    )
    db_session.commit()

    matched, strategy = film_repository.find_for_rss_watched(
        db_session,
        "https://letterboxd.com/hastiecraig/film/stalker/",
        title="Stalker",
        year=1979,
    )

    assert matched is not None
    assert matched.id == film.id
    assert strategy == "canonical"


def test_find_for_rss_watched_matches_slug_without_trailing_slash(db_session):
    film = _create_film(
        db_session,
        title="Stalker",
        letterboxd_uri="https://letterboxd.com/film/stalker",
        year=1979,
    )
    db_session.commit()

    matched, strategy = film_repository.find_for_rss_watched(
        db_session,
        "https://letterboxd.com/hastiecraig/film/stalker/",
        title="Stalker",
        year=1979,
    )

    assert matched is not None
    assert matched.id == film.id
    assert strategy == "slug"


def test_find_for_rss_watched_matches_title_only_when_year_missing(db_session):
    film = _create_film(
        db_session,
        title="The Long Walk",
        letterboxd_uri="https://boxd.it/mic8",
        year=2025,
    )
    watchlist_repository.create_active_entry(
        db_session,
        film_id=film.id,
        letterboxd_uri=film.letterboxd_uri,
    )
    db_session.commit()

    matched, strategy = film_repository.find_for_rss_watched(
        db_session,
        "https://letterboxd.com/hastiecraig/film/the-long-walk-2025/",
        title="The Long Walk",
        year=None,
    )

    assert matched is not None
    assert matched.id == film.id
    assert strategy == "title_year"
