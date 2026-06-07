"""API v1 routes."""

from fastapi import APIRouter

from app.routers.v1.health import router as health_router

router = APIRouter()
router.include_router(health_router)
