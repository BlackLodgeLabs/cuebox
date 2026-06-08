"""Unit tests for shared enrichment pipeline failure helpers."""

import uuid


from app.database.enums import EnrichmentStatus
from app.repositories import film_repository, import_job_repository
from app.services.enrichment_pipeline import mark_film_failed, sync_import_job_progress
from app.services.metadata_service import MetadataService
from tests.conftest import requires_db

pytestmark = requires_db


def test_mark_film_failed_records_failure_summary(db_session):
    job = import_job_repository.create(db_session)
    film = film_repository.create(
        db_session,
        title="Fail",
        letterboxd_uri=f"https://letterboxd.com/film/fail-{uuid.uuid4()}/",
        year=2000,
        import_job_id=job.id,
    )
    import_job_repository.update_counters(db_session, job, total_films=1)
    db_session.commit()

    mark_film_failed(db_session, film, "Semantic provider error")
    sync_import_job_progress(db_session, job.id)
    db_session.commit()

    refreshed = import_job_repository.get_by_id(db_session, job.id)
    assert refreshed is not None
    assert refreshed.failure_summary
    assert refreshed.failure_summary[0]["reason"] == "Semantic provider error"
    assert refreshed.failed_films == 1


def test_metadata_mark_failed_uses_shared_helper(db_session, monkeypatch):
    job = import_job_repository.create(db_session)
    film = film_repository.create(
        db_session,
        title="Meta Fail",
        letterboxd_uri=f"https://letterboxd.com/film/meta-{uuid.uuid4()}/",
        year=2000,
        import_job_id=job.id,
    )
    import_job_repository.update_counters(db_session, job, total_films=1)
    db_session.commit()

    from app.services.enrichment_pipeline import mark_film_failed as original

    calls: list[str] = []

    def spy(db, f, reason):
        calls.append(reason)
        return original(db, f, reason)

    monkeypatch.setattr("app.services.metadata_service.mark_film_failed", spy)

    service = MetadataService(provider_service=object())  # type: ignore[arg-type]
    service._mark_failed(db_session, film, "TMDB match not found")
    assert calls == ["TMDB match not found"]
    assert film.enrichment_status == EnrichmentStatus.FAILED
