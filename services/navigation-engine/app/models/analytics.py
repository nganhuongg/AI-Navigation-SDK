"""Analytics event and dashboard models."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class AnalyticsEventRequest(BaseModel):
    event_type: str
    session_id: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AnalyticsEvent(BaseModel):
    event_id: str
    event_type: str
    session_id: Optional[str] = None
    timestamp: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class TopLocation(BaseModel):
    location_id: str
    count: int


class RecentFallback(BaseModel):
    event_id: str
    reason: str
    timestamp: str


class DashboardSummary(BaseModel):
    total_sessions: int
    total_routes_requested: int
    total_steps_completed: int
    total_fallbacks: int
    top_locations: list[TopLocation] = Field(default_factory=list)
    recent_fallbacks: list[RecentFallback] = Field(default_factory=list)
