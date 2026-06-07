"""Database engine and connection probe for health checks."""

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

_engine: Engine | None = None


def init_engine(database_url: str) -> None:
    global _engine
    _engine = create_engine(database_url)


def check_database() -> bool:
    if _engine is None:
        return False

    try:
        with _engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
