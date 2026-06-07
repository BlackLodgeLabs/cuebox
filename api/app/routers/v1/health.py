"""Health check endpoint per api-contracts.md §10.1."""

from typing import Literal

from fastapi import APIRouter

from app.core.config import AppConfig, Settings, get_app_config, get_settings
from app.database.session import check_database
from app.schemas.health import HealthProviders, HealthResponse

router = APIRouter(tags=["health"])

API_VERSION = "1.0.0"

_PROVIDER_KEY_ATTR: dict[str, str] = {
    "openai": "openai_api_key",
    "anthropic": "anthropic_api_key",
}


def _provider_status(provider_name: str, settings: Settings) -> Literal["ok", "error"]:
    attr = _PROVIDER_KEY_ATTR.get(provider_name)
    if attr is None:
        return "error"

    api_key = getattr(settings, attr, None)
    return "ok" if api_key else "error"


def _check_providers(config: AppConfig, settings: Settings) -> HealthProviders:
    return HealthProviders(
        embedding=_provider_status(config.providers.embedding.provider, settings),
        semantic_enrichment=_provider_status(
            config.providers.semantic_enrichment.provider, settings
        ),
        ranking=_provider_status(config.providers.ranking.provider, settings),
    )


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    settings = get_settings()
    config = get_app_config()

    return HealthResponse(
        status="ok",
        database="ok" if check_database() else "error",
        providers=_check_providers(config, settings),
        version=API_VERSION,
    )
