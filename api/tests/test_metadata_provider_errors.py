"""Metadata provider error messaging integration tests."""

from __future__ import annotations

import uuid

import pytest

from tests.conftest import requires_db
from tests.test_integration_import import _import_csv, _wait_for_complete

pytestmark = requires_db


@pytest.fixture
def mock_profile():
    return "partial_http_failure"


def test_all_candidate_fetches_fail_reports_provider_error(integration_client):
    suffix = uuid.uuid4().hex[:8]
    uri = f"https://letterboxd.com/film/partial-{suffix}/"
    csv_once = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,Partial Fail,2001,{uri}\n"
    ).encode()

    created = _import_csv(integration_client, csv_once)
    status = _wait_for_complete(integration_client, created["job_id"])

    assert status["failed_films"] == 1
    assert status["failure_summary"]
    reason = status["failure_summary"][0]["reason"]
    assert "provider HTTP errors" in reason


def test_empty_search_reports_not_found(integration_client):
    suffix = uuid.uuid4().hex[:8]
    uri = f"https://letterboxd.com/film/notfound-{suffix}/"
    csv_once = (
        "Date,Title,Year,Letterboxd URI\n"
        f"2024-01-01,Unknown Film,2020,{uri}\n"
    ).encode()

    created = _import_csv(integration_client, csv_once)
    status = _wait_for_complete(integration_client, created["job_id"])

    assert status["failed_films"] == 1
    assert status["failure_summary"][0]["reason"] == "TMDB match not found"
