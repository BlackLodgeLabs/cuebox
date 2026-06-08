"""Import job lifecycle integration tests for multi-job retry invariants."""

from __future__ import annotations

import uuid

from tests.conftest import requires_db
from tests.test_integration_import import _import_csv, _wait_for_complete

pytestmark = requires_db


def test_retry_updates_old_job_counters(integration_client):
    suffix = uuid.uuid4().hex[:8]
    uri = f"https://letterboxd.com/film/retry-counters-{suffix}/"
    csv_once = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,Unknown Film,2020,{uri}\n"
    ).encode()

    first = _import_csv(integration_client, csv_once)
    first_status = _wait_for_complete(integration_client, first["job_id"])
    assert first_status["failed_films"] == 1
    assert first_status["total_films"] == 1
    assert first_status["processed_films"] == 1
    assert first_status["processed_films"] <= first_status["total_films"]

    second = _import_csv(integration_client, csv_once)
    second_status = _wait_for_complete(integration_client, second["job_id"])
    assert second_status["duplicate_films"] == 0
    assert second_status["total_films"] == 1

    old_status = integration_client.get(f"/api/v1/import/{first['job_id']}/status")
    assert old_status.status_code == 200
    old_payload = old_status.json()
    assert old_payload["status"] == "complete"
    assert old_payload["total_films"] == 0
    assert old_payload["processed_films"] <= (old_payload["total_films"] or 0)


def test_retry_does_not_increment_duplicate_films(integration_client):
    suffix = uuid.uuid4().hex[:8]
    uri = f"https://letterboxd.com/film/retry-dup-{suffix}/"
    csv_once = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,Unknown Film,2020,{uri}\n"
    ).encode()

    created = _import_csv(integration_client, csv_once)
    _wait_for_complete(integration_client, created["job_id"])

    retry = _import_csv(integration_client, csv_once)
    retry_status = _wait_for_complete(integration_client, retry["job_id"])
    assert retry_status["duplicate_films"] == 0


def test_failure_summary_preserved_on_sync(integration_client):
    suffix = uuid.uuid4().hex[:8]
    uri = f"https://letterboxd.com/film/summary-{suffix}/"
    csv_once = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,Unknown Film,2020,{uri}\n"
    ).encode()

    created = _import_csv(integration_client, csv_once)
    status = _wait_for_complete(integration_client, created["job_id"])

    assert status["failure_summary"]
    reason = status["failure_summary"][0]["reason"]
    assert reason == "TMDB match not found"
    assert reason != "Enrichment failed"
