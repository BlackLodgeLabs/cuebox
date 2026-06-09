"""Unit tests for import job processed counter semantics."""

import uuid


from app.database.enums import EnrichmentStatus
from app.repositories import film_repository, import_job_repository
from tests.conftest import requires_db

pytestmark = requires_db


def test_enriching_not_counted_as_processed(db_session):
    job = import_job_repository.create(db_session)
    film = film_repository.create(
        db_session,
        title="Test",
        letterboxd_uri=f"https://letterboxd.com/film/{uuid.uuid4()}/",
        year=2000,
        import_job_id=job.id,
    )
    import_job_repository.update_counters(db_session, job, total_films=1)
    film_repository.update_enrichment_status(db_session, film, EnrichmentStatus.ENRICHING)
    db_session.commit()

    counts = film_repository.count_by_import_job_status(db_session, job.id)
    assert counts["processed"] == 0


def test_ready_and_failed_count_as_processed(db_session):
    job = import_job_repository.create(db_session)
    ready = film_repository.create(
        db_session,
        title="Ready Film",
        letterboxd_uri=f"https://letterboxd.com/film/ready-{uuid.uuid4()}/",
        year=2000,
        import_job_id=job.id,
    )
    failed = film_repository.create(
        db_session,
        title="Failed Film",
        letterboxd_uri=f"https://letterboxd.com/film/failed-{uuid.uuid4()}/",
        year=2001,
        import_job_id=job.id,
    )
    import_job_repository.update_counters(db_session, job, total_films=2)
    film_repository.update_enrichment_status(db_session, ready, EnrichmentStatus.READY)
    film_repository.update_enrichment_status(db_session, failed, EnrichmentStatus.FAILED)
    db_session.commit()

    counts = film_repository.count_by_import_job_status(db_session, job.id)
    assert counts["processed"] == 2
    assert counts["failed"] == 1
