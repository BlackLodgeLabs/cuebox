"""Integration tests for RSS synchronisation."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.database.session import SessionLocal
from tests.conftest import requires_db
from tests.test_rss_parser import DIARY_XML

pytestmark = requires_db


@pytest.mark.asyncio
async def test_rss_poll_idempotent(integration_client, db_session):
    username = f"user{uuid.uuid4().hex[:6]}"
    integration_client.put("/api/v1/sync/rss", json={"username": username})

    async def fake_fetch(client, url):
        assert "/rss/" in url
        assert "/watchlist/" not in url
        return DIARY_XML

    with patch("app.services.sync_service.fetch_feed", new=AsyncMock(side_effect=fake_fetch)):
        from app.services.sync_service import SyncService

        service = SyncService(integration_client.app.state.provider_service)
        with SessionLocal() as db:
            await service.poll_rss(db)
            second = await service.poll_rss(db)
            count = db.execute(
                __import__("sqlalchemy").text("SELECT count(*) FROM rss_sync_events")
            ).scalar_one()

    assert second == 0
    assert count >= 1


def test_rss_status_after_configure(integration_client):
    username = f"status{uuid.uuid4().hex[:6]}"
    put = integration_client.put("/api/v1/sync/rss", json={"username": username})
    assert put.status_code == 200
    assert put.json()["polling_interval_seconds"] == 900

    status = integration_client.get("/api/v1/sync/rss/status").json()
    assert status["configured"] is True
    assert status["username"] == username
