"""Anonymous analytics dashboard endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.common import APIResponse
from app.services.analytics import event_logger

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def dashboard_summary() -> APIResponse:
    """Return aggregate dashboard metrics."""
    return APIResponse.ok(event_logger.build_summary().model_dump())


@router.get("/top-locations")
def dashboard_top_locations() -> APIResponse:
    """Return the most requested locations."""
    return APIResponse.ok([item.model_dump() for item in event_logger.build_summary().top_locations])


@router.get("/fallbacks")
def dashboard_fallbacks() -> APIResponse:
    """Return recent fallback events."""
    return APIResponse.ok([item.model_dump() for item in event_logger.build_summary().recent_fallbacks])
