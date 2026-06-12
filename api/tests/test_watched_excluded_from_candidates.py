"""Integration test — watched films excluded from recommendation candidates."""

from app.database.enums import FilmStatus
from app.repositories import film_repository, watchlist_repository
from tests.conftest import requires_db
from tests.helpers.seed_ready_films import seed_ready_films

pytestmark = requires_db


def test_watched_film_excluded_from_stage1_query(db_session):
    films = seed_ready_films(db_session, count=3)
    watched = films[0]
    film_repository.mark_watched(db_session, watched)
    entry = watchlist_repository.get_active_by_film_id(db_session, watched.id)
    if entry:
        watchlist_repository.deactivate_entry(db_session, entry)
    db_session.commit()

    candidates = film_repository.list_recommendation_candidates(db_session)
    candidate_ids = {film.id for film in candidates}
    assert watched.id not in candidate_ids
    assert watched.status == FilmStatus.WATCHED


def test_non_english_film_excluded_when_subtitles_no(db_session):
    films = seed_ready_films(db_session, count=2)
    foreign = films[0]
    foreign.metadata_.original_language = "fr"
    db_session.commit()

    english_only = film_repository.list_recommendation_candidates(
        db_session,
        exclude_non_english=True,
    )
    assert foreign.id not in {film.id for film in english_only}

    all_candidates = film_repository.list_recommendation_candidates(db_session)
    assert foreign.id in {film.id for film in all_candidates}
