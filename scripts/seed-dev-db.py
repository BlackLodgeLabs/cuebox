#!/usr/bin/env python3
"""Seed the dev database with ready films for cloud agent / UI testing."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from app.database.session import SessionLocal, init_engine
from tests.helpers.seed_ready_films import seed_ready_films

# Host port for Compose Postgres (5433:5432 in docker-compose.yml)
DEFAULT_URL = "postgresql+psycopg://cuebox:cuebox@localhost:5433/cuebox"
COUNT = int(os.environ.get("SEED_FILM_COUNT", "10"))


def main() -> None:
    url = os.environ.get("DATABASE_URL", DEFAULT_URL)
    # When run from host against Compose, rewrite docker hostname to localhost:5433
    if "@postgres:" in url:
        url = url.replace("@postgres:5432", "@localhost:5433")
    init_engine(url)
    with SessionLocal() as db:
        films = seed_ready_films(db, count=COUNT)
    print(f"Seeded {len(films)} ready films")


if __name__ == "__main__":
    main()
