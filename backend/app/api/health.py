"""Health and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe. Used by Docker healthcheck and platform health checks."""
    return {"status": "ok"}
