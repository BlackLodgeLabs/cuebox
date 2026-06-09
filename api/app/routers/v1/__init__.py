"""API v1 routes."""

from fastapi import APIRouter

from app.routers.v1.films import router as films_router
from app.routers.v1.health import router as health_router
from app.routers.v1.imports import router as import_router
from app.routers.v1.recommendations import router as recommendations_router
from app.routers.v1.reviews import router as reviews_router
from app.routers.v1.sync import router as sync_router

router = APIRouter()
router.include_router(health_router)
router.include_router(import_router)
router.include_router(films_router)
router.include_router(reviews_router)
router.include_router(sync_router)
router.include_router(recommendations_router)
