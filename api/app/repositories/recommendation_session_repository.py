"""Recommendation session data-access helpers."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database.enums import FilmStatus
from app.database.models import Film, RecommendationSession


def create(
    db: Session,
    *,
    profile_id: uuid.UUID,
    winner_film_id: uuid.UUID | None,
    ranking_provider: str | None,
    ranking_model: str | None,
    semantic_version: str | None,
    embedding_version: str | None,
    scoring_version: str | None,
    weight_set: str | None,
    prompt_version: str | None,
    constraint_relaxation: dict | None,
) -> RecommendationSession:
    session = RecommendationSession(
        profile_id=profile_id,
        winner_film_id=winner_film_id,
        ranking_provider=ranking_provider,
        ranking_model=ranking_model,
        semantic_version=semantic_version,
        embedding_version=embedding_version,
        scoring_version=scoring_version,
        weight_set=weight_set,
        prompt_version=prompt_version,
        constraint_relaxation=constraint_relaxation,
    )
    db.add(session)
    db.flush()
    return session


def get_by_id(db: Session, session_id: uuid.UUID) -> RecommendationSession | None:
    stmt = (
        select(RecommendationSession)
        .where(RecommendationSession.id == session_id)
        .options(
            selectinload(RecommendationSession.profile),
            selectinload(RecommendationSession.candidates),
            selectinload(RecommendationSession.result),
        )
    )
    return db.scalars(stmt).first()


def list_history(
    db: Session,
    *,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    watch_status: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[RecommendationSession], int]:
    stmt = select(RecommendationSession).options(selectinload(RecommendationSession.profile))
    count_stmt = select(func.count()).select_from(RecommendationSession)

    if search or watch_status:
        stmt = stmt.outerjoin(Film, RecommendationSession.winner_film_id == Film.id)
        count_stmt = count_stmt.outerjoin(Film, RecommendationSession.winner_film_id == Film.id)

    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(func.lower(Film.title).like(pattern))
        count_stmt = count_stmt.where(func.lower(Film.title).like(pattern))

    if date_from is not None:
        start = datetime.combine(date_from, datetime.min.time())
        stmt = stmt.where(RecommendationSession.created_at >= start)
        count_stmt = count_stmt.where(RecommendationSession.created_at >= start)
    if date_to is not None:
        end = datetime.combine(date_to, datetime.max.time())
        stmt = stmt.where(RecommendationSession.created_at <= end)
        count_stmt = count_stmt.where(RecommendationSession.created_at <= end)

    if watch_status is not None:
        status = FilmStatus(watch_status)
        stmt = stmt.where(Film.status == status)
        count_stmt = count_stmt.where(Film.status == status)

    total = db.scalar(count_stmt) or 0
    sessions = list(
        db.scalars(
            stmt.order_by(RecommendationSession.created_at.desc()).limit(limit).offset(offset)
        ).all()
    )
    return sessions, total
