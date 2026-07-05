"""FastAPI dependency injection helpers."""

from fastapi import Request

from app.database.session import get_db
from app.services.developer_service import DeveloperService
from app.services.import_service import ImportService
from app.services.metadata_service import MetadataService
from app.services.provider_service import ProviderService
from app.services.recommendation_service import RecommendationService
from app.services.sync_service import SyncService
from app.services.watch_provider_service import WatchProviderService


def get_provider_service(request: Request) -> ProviderService:
    return request.app.state.provider_service


def get_import_service(request: Request) -> ImportService:
    return ImportService(get_provider_service(request))


def get_metadata_service(request: Request) -> MetadataService:
    return MetadataService(get_provider_service(request))


def get_sync_service(request: Request) -> SyncService:
    return SyncService(get_provider_service(request))


def get_recommendation_service(request: Request) -> RecommendationService:
    return RecommendationService(get_provider_service(request))


def get_developer_service() -> DeveloperService:
    return DeveloperService()


def get_watch_provider_service(request: Request) -> WatchProviderService:
    return WatchProviderService(get_provider_service(request))


__all__ = [
    "get_db",
    "get_developer_service",
    "get_import_service",
    "get_metadata_service",
    "get_provider_service",
    "get_recommendation_service",
    "get_sync_service",
    "get_watch_provider_service",
]
