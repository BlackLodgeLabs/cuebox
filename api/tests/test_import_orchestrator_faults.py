"""Orchestrator fault-injection integration tests."""

from __future__ import annotations

import uuid

from app.database.enums import EnrichmentStatus
from app.repositories import film_repository
from app.services.metadata_service import MetadataService
from tests.conftest import requires_db
from tests.test_integration_import import _import_csv, _wait_for_complete

pytestmark = requires_db


def test_per_film_crash_does_not_halt_job(integration_client, monkeypatch):
    suffix = uuid.uuid4().hex[:8]
    csv_content = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,Crash Film,2000,https://letterboxd.com/film/crash-{suffix}-a/\n"
        f"2024-01-02,The Matrix,1999,https://letterboxd.com/film/crash-{suffix}-b/\n"
    ).encode()

    original = MetadataService.enrich_film
    call_count = {"value": 0}

    async def flaky_enrich(self, db, film_id):
        call_count["value"] += 1
        if call_count["value"] == 1:
            raise RuntimeError("simulated per-film crash")
        return await original(self, db, film_id)

    monkeypatch.setattr(MetadataService, "enrich_film", flaky_enrich)

    created = _import_csv(integration_client, csv_content)
    status = _wait_for_complete(integration_client, created["job_id"])

    assert status["status"] == "complete"
    assert status["failed_films"] == 1
    assert status["processed_films"] == 2


def test_film_not_stuck_in_matching(integration_client, monkeypatch):
    suffix = uuid.uuid4().hex[:8]
    uri = f"https://letterboxd.com/film/matching-{suffix}/"
    csv_once = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,The Matrix,1999,{uri}\n"
    ).encode()

    async def fail_after_matching(self, db, film_id):
        film = film_repository.get_by_id(db, film_id)
        film_repository.update_enrichment_status(db, film, EnrichmentStatus.MATCHING)
        db.flush()
        raise RuntimeError("simulated failure after matching")

    monkeypatch.setattr(MetadataService, "enrich_film", fail_after_matching)

    created = _import_csv(integration_client, csv_once)
    status = _wait_for_complete(integration_client, created["job_id"])
    assert status["status"] == "complete"
    assert status["failed_films"] == 1

    films = integration_client.get("/api/v1/films?limit=50").json()["data"]
    film = next(item for item in films if item["letterboxd_uri"] == uri)
    assert film["enrichment_status"] != EnrichmentStatus.MATCHING.value


def test_integrity_error_marks_failed(integration_client):
    suffix = uuid.uuid4().hex[:8]
    csv_content = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,The Matrix,1999,https://letterboxd.com/film/dup-{suffix}-a/\n"
        f"2024-01-02,The Matrix,1999,https://letterboxd.com/film/dup-{suffix}-b/\n"
    ).encode()

    created = _import_csv(integration_client, csv_content)
    status = _wait_for_complete(integration_client, created["job_id"], timeout=45.0)

    assert status["status"] == "complete"
    assert status["processed_films"] == 2
    assert status["failed_films"] >= 1

    films = integration_client.get("/api/v1/films?limit=50").json()["data"]
    dup_films = [f for f in films if f"dup-{suffix}" in f["letterboxd_uri"]]
    assert len(dup_films) == 2
    statuses = {f["enrichment_status"] for f in dup_films}
    assert EnrichmentStatus.MATCHING.value not in statuses
    assert EnrichmentStatus.PENDING.value not in statuses
