"""FastAPI dependency injection helpers."""

from fastapi import Request

from app.database.session import get_db
from app.services.import_service import ImportService
from app.services.metadata_service import MetadataService
from app.services.provider_service import ProviderService


def get_provider_service(request: Request) -> ProviderService:
    return request.app.state.provider_service


def get_import_service(request: Request) -> ImportService:
    return ImportService(get_provider_service(request))


def get_metadata_service(request: Request) -> MetadataService:
    return MetadataService(get_provider_service(request))


__all__ = [
    "get_db",
    "get_import_service",
    "get_metadata_service",
    "get_provider_service",
]
