"""Analytics event endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.analytics import AnalyticsEventRequest
from app.models.common import APIResponse
from app.services.analytics import event_logger

router = APIRouter(tags=["analytics"])


@router.post("/events/log")
def log_event(request: AnalyticsEventRequest) -> APIResponse:
    """Append one anonymous analytics event."""
    event = event_logger.log_event(request)
    return APIResponse.ok(event.model_dump())
