"""Environment-driven configuration."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Service metadata
    app_name: str = "Wryte API"
    scoring_version: str = "v1"

    # CORS - comma-separated list of allowed origins.
    # Next defaults to 3000 but auto-bumps to 3001/3002 if busy, so we whitelist a small range.
    cors_allow_origins: str = (
        "http://localhost:3000,http://localhost:3001,http://localhost:3002,"
        "http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002"
    )

    # External services
    languagetool_url: str = "http://languagetool:8010/v2"

    # Storage
    database_url: str = "sqlite+aiosqlite:///./data/wryte.db"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]


settings = Settings()
