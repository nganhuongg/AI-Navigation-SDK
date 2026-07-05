"""Anonymous analytics event logging and dashboard aggregation."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import uuid

from app.models.analytics import (
    AnalyticsEvent,
    AnalyticsEventRequest,
    DashboardSummary,
    RecentFallback,
    TopLocation,
)
from app.storage import runtime_store

ROUTE_EVENT_TYPES = {"route_requested", "route_not_found"}
STEP_EVENT_TYPES = {"step_completed", "arrive"}
FALLBACK_EVENT_TYPES = {"fallback", "assistant_fallback", "route_not_found", "ocr_low_confidence"}


def log_event(request: AnalyticsEventRequest) -> AnalyticsEvent:
    """Persist one anonymous event."""
    event = AnalyticsEvent(
        event_id="evt_" + uuid.uuid4().hex[:16],
        event_type=request.event_type,
        session_id=request.session_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        metadata=request.metadata,
    )
    runtime_store.append_event(event.model_dump())
    return event


def list_events() -> list[AnalyticsEvent]:
    """Return all logged events in insertion order."""
    return [AnalyticsEvent(**event) for event in runtime_store.load_events()]


def build_summary() -> DashboardSummary:
    """Aggregate the anonymous event log for the admin dashboard."""
    events = list_events()
    sessions = {event.session_id for event in events if event.session_id}
    location_counts: Counter[str] = Counter()
    fallbacks: list[RecentFallback] = []

    for event in events:
        location_id = event.metadata.get("location_id") or event.metadata.get("destination_location_id")
        if isinstance(location_id, str) and location_id:
            location_counts[location_id] += 1

        if event.event_type in FALLBACK_EVENT_TYPES:
            reason = event.metadata.get("reason", event.event_type)
            fallbacks.append(
                RecentFallback(
                    event_id=event.event_id,
                    reason=str(reason),
                    timestamp=event.timestamp,
                )
            )

    return DashboardSummary(
        total_sessions=len(sessions),
        total_routes_requested=sum(1 for event in events if event.event_type in ROUTE_EVENT_TYPES),
        total_steps_completed=sum(1 for event in events if event.event_type in STEP_EVENT_TYPES),
        total_fallbacks=len(fallbacks),
        top_locations=[
            TopLocation(location_id=location_id, count=count)
            for location_id, count in location_counts.most_common(10)
        ],
        recent_fallbacks=list(reversed(fallbacks[-10:])),
    )
