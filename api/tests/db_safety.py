"""Guardrails so pytest never truncates the Docker Compose dev database."""

from __future__ import annotations

import os
from urllib.parse import urlparse

# Compose service hostname (api/.env DATABASE_URL) and host-published port (5433:5432).
_COMPOSE_DEV_HOSTS = frozenset({"postgres"})
_COMPOSE_DEV_HOST_PORTS = frozenset({("localhost", 5433), ("127.0.0.1", 5433), ("::1", 5433)})

ALLOW_COMPOSE_DB_ENV = "CUEBOX_TEST_ALLOW_COMPOSE_DB"

COMPOSE_DB_REFUSAL_MESSAGE = (
    "Refusing to run DB-isolating tests against the Docker Compose dev database ({url!r}). "
    "Use a dedicated test Postgres (e.g. localhost:5432 from verify-*-gates.sh) or unset "
    "DATABASE_URL/TEST_DATABASE_URL for unit-only runs. "
    f"Set {ALLOW_COMPOSE_DB_ENV}=1 to override (not recommended)."
)


def is_compose_dev_database_url(url: str) -> bool:
    """Return True when *url* targets the local Compose Postgres volume."""
    if not url:
        return False
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    port = parsed.port
    if host in _COMPOSE_DEV_HOSTS and port in (None, 5432):
        return True
    return (host, port) in _COMPOSE_DEV_HOST_PORTS


def assert_safe_test_database_url(url: str) -> None:
    """Raise RuntimeError if tests would truncate the Compose dev database."""
    if not url or os.environ.get(ALLOW_COMPOSE_DB_ENV) == "1":
        return
    if is_compose_dev_database_url(url):
        raise RuntimeError(COMPOSE_DB_REFUSAL_MESSAGE.format(url=url))
