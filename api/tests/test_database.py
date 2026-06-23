"""Database schema and repository integration tests.

Requires a migrated PostgreSQL database. Set TEST_DATABASE_URL or DATABASE_URL.
Skipped when no database URL is configured.
"""

import os
import uuid

import pytest
from sqlalchemy import inspect, text

from app.database.enums import ArtifactType, EnrichmentStatus
from app.database.models import Film
from app.database.session import SessionLocal, init_engine
from app.repositories import film_repository, import_job_repository, system_version_repository
from tests.db_safety import assert_safe_test_database_url

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    os.environ.get("DATABASE_URL", ""),
)


pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL or DATABASE_URL not set",
)


@pytest.fixture(scope="module")
def db_session():
    assert_safe_test_database_url(TEST_DATABASE_URL)
    init_engine(TEST_DATABASE_URL)
    session = SessionLocal()
    yield session
    session.close()


def test_schema_has_fourteen_application_tables(db_session):
    table_names = set(inspect(db_session.bind).get_table_names())
    expected = {
        "import_jobs",
        "films",
        "film_metadata",
        "film_semantic_profiles",
        "film_embeddings",
        "watchlist_entries",
        "metadata_match_reviews",
        "recommendation_profiles",
        "recommendation_sessions",
        "recommendation_candidates",
        "recommendation_results",
        "recommendation_exposure",
        "rss_sync_events",
        "system_versions",
    }
    assert expected.issubset(table_names)


def test_system_versions_seed_data(db_session):
    rows = system_version_repository.get_active_by_artifact_type(db_session, ArtifactType.SEMANTIC)
    assert len(rows) == 1
    assert rows[0].version == "semantic-v1"

    all_active = db_session.execute(
        text("SELECT COUNT(*) FROM system_versions WHERE active = true")
    ).scalar_one()
    assert all_active == 4


def test_film_repository_round_trip(db_session):
    uri = f"https://letterboxd.com/film/pytest-{uuid.uuid4()}/"
    film = Film(title="Pytest Film", letterboxd_uri=uri, year=2020)
    db_session.add(film)
    db_session.commit()

    found = film_repository.get_by_letterboxd_uri(db_session, uri)
    assert found is not None
    assert found.title == "Pytest Film"

    ready_list = film_repository.list_by_enrichment_status(
        db_session, EnrichmentStatus.PENDING, limit=5
    )
    assert any(item.letterboxd_uri == uri for item in ready_list)


def test_import_job_repository(db_session):
    job = import_job_repository.create(db_session, total_films=10)
    db_session.commit()

    found = import_job_repository.get_by_id(db_session, job.id)
    assert found is not None
    assert found.total_films == 10

    import_job_repository.update_counters(db_session, found, processed_films=3)
    db_session.commit()
    assert found.processed_films == 3
