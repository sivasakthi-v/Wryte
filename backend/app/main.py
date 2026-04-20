"""FastAPI application entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import analyze, health
from app.config import settings


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Startup/shutdown hooks.

    In V1 this is a no-op. As analyzers land we'll load spaCy, sentence-transformers,
    and warm LanguageTool here so the first request doesn't pay a cold-start tax.
    """
    # TODO: load spaCy model, load sentence-transformers, ping LanguageTool.
    yield
    # TODO: clean up any resources.


def create_app() -> FastAPI:
    """Application factory."""
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=(
            "Content Intelligence Dashboard API. Diagnostic scoring for text content — "
            "readability, structure, intent, search visibility, and trust."
        ),
        lifespan=lifespan,
    )

    # The regex is the bulletproof part: any localhost/127.0.0.1 port works in dev,
    # and any Netlify preview deploy works in prod. Explicit origins list is still
    # honored for anything that doesn't match (e.g. a custom domain passed via env).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_origin_regex=(
            r"^https?://localhost(:\d+)?$"
            r"|^https?://127\.0\.0\.1(:\d+)?$"
            r"|^https://.*\.netlify\.app$"
        ),
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(analyze.router)

    @app.get("/", tags=["root"])
    async def root() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "version": __version__,
            "scoring_version": settings.scoring_version,
            "docs": "/docs",
        }

    return app


app = create_app()
