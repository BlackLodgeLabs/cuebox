"""Unit tests for import job counter updates and failure_summary sentinel."""

from __future__ import annotations

import os
import uuid

import pytest

from app.database.session import SessionLocal, init_engine
from app.repositories import import_job_repository

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    os.environ.get("DATABASE_URL", ""),
)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL or DATABASE_URL not set",
)


@pytest.fixture
def db_session():
    init_engine(TEST_DATABASE_URL)
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()


def test_clear_failure_summary_with_none(db_session):
    job = import_job_repository.create(db_session, total_films=1)
    import_job_repository.update_counters(
        db_session,
        job,
        failure_summary=[{"letterboxd_uri": "https://example.com/film/x/", "reason": "failed"}],
    )
    db_session.commit()

    import_job_repository.update_counters(db_session, job, failure_summary=None)
    db_session.commit()

    assert job.failure_summary is None


def test_omit_failure_summary_preserves_existing(db_session):
    summary = [{"letterboxd_uri": f"https://example.com/film/{uuid.uuid4()}/", "reason": "x"}]
    job = import_job_repository.create(db_session, total_films=1)
    import_job_repository.update_counters(db_session, job, failure_summary=summary)
    db_session.commit()

    import_job_repository.update_counters(db_session, job, processed_films=1)
    db_session.commit()

    assert job.failure_summary == summary


def test_set_failure_summary_updates_value(db_session):
    job = import_job_repository.create(db_session, total_films=1)
    new_summary = [{"letterboxd_uri": "https://example.com/film/y/", "reason": "provider error"}]
    import_job_repository.update_counters(db_session, job, failure_summary=new_summary)
    db_session.commit()

    assert job.failure_summary == new_summary
