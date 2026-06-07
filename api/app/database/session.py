"""Database engine, session factory, and FastAPI dependency."""

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

_engine: Engine | None = None
SessionLocal = sessionmaker(autoflush=False, autocommit=False)


def init_engine(database_url: str) -> None:
    global _engine
    if _engine is not None:
        _engine.dispose()
    _engine = create_engine(database_url)
    SessionLocal.configure(bind=_engine)


def get_engine() -> Engine | None:
    return _engine


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database() -> bool:
    if _engine is None:
        return False

    try:
        with _engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        import logging

        logging.getLogger(__name__).exception("Database connection check failed")
        return False
