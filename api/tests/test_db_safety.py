"""Unit tests for Compose dev database URL detection."""

from __future__ import annotations

import pytest

from tests.db_safety import (
    ALLOW_COMPOSE_DB_ENV,
    assert_safe_test_database_url,
    is_compose_dev_database_url,
)


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+psycopg://cuebox:cuebox@postgres:5432/cuebox",
        "postgresql://cuebox:cuebox@postgres/cuebox",
        "postgresql+psycopg://cuebox:cuebox@localhost:5433/cuebox",
        "postgresql+psycopg://cuebox:cuebox@127.0.0.1:5433/cuebox",
        "postgresql+psycopg://cuebox:cuebox@[::1]:5433/cuebox",
    ],
)
def test_is_compose_dev_database_url_detects_compose_targets(url: str) -> None:
    assert is_compose_dev_database_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "",
        "postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox",
        "postgresql+psycopg://cuebox:cuebox@127.0.0.1:5432/cuebox",
        "postgresql+psycopg://cuebox:cuebox@testhost:5432/cuebox",
        "postgresql+psycopg://cuebox:cuebox@localhost:invalid_port/cuebox",
    ],
)
def test_is_compose_dev_database_url_allows_test_databases(url: str) -> None:
    assert not is_compose_dev_database_url(url)


def test_assert_safe_test_database_url_refuses_compose(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(ALLOW_COMPOSE_DB_ENV, raising=False)
    with pytest.raises(RuntimeError, match="Refusing to run DB-isolating tests"):
        assert_safe_test_database_url("postgresql+psycopg://cuebox:cuebox@localhost:5433/cuebox")


def test_assert_safe_test_database_url_allows_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ALLOW_COMPOSE_DB_ENV, "1")
    assert_safe_test_database_url("postgresql+psycopg://cuebox:cuebox@localhost:5433/cuebox")
