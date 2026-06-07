"""Configuration loading and validation."""

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ProviderConfig(BaseModel):
    provider: str
    model: str


class ProvidersConfig(BaseModel):
    embedding: ProviderConfig
    semantic_enrichment: ProviderConfig
    ranking: ProviderConfig


class RecommendationConfig(BaseModel):
    retrieval_candidate_limit: int


class ScoringConfig(BaseModel):
    theme_fit: float
    emotional_fit: float
    pacing_fit: float
    complexity_fit: float
    era_fit: float
    obscurity_fit: float
    viewing_context_fit: float
    diversity_adjustment: float

    @model_validator(mode="after")
    def validate_weights_sum(self) -> "ScoringConfig":
        total = (
            self.theme_fit
            + self.emotional_fit
            + self.pacing_fit
            + self.complexity_fit
            + self.era_fit
            + self.obscurity_fit
            + self.viewing_context_fit
            + self.diversity_adjustment
        )
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Scoring weights must sum to 1.0 (±0.01), got {total:.4f}")
        return self


class AppConfig(BaseModel):
    developer_mode: bool
    providers: ProvidersConfig
    recommendation: RecommendationConfig
    scoring: ScoringConfig


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(alias="DATABASE_URL")
    config_path: Path = Field(default=Path("/app/config.yaml"), alias="CONFIG_PATH")
    tmdb_api_key: str | None = Field(default=None, alias="TMDB_API_KEY")
    omdb_api_key: str | None = Field(default=None, alias="OMDB_API_KEY")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")


_app_config: AppConfig | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()


def load_app_config(path: Path) -> AppConfig:
    if not path.is_file():
        raise FileNotFoundError(f"Config file not found: {path}")

    with path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    if not isinstance(raw, dict):
        raise ValueError(f"Config file must contain a YAML mapping: {path}")

    return AppConfig.model_validate(raw)


def get_app_config() -> AppConfig:
    if _app_config is None:
        raise RuntimeError("App config has not been loaded. Call init_app_config() first.")
    return _app_config


def init_app_config(path: Path | None = None) -> AppConfig:
    global _app_config
    settings = get_settings()
    config_path = path or settings.config_path
    _app_config = load_app_config(config_path)
    return _app_config
