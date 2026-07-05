"""Phase 6 route stub.

Map digitization is deferred. This service returns Vietnamese text directions
from location metadata and marks ``map_available`` false so the frontend can
show a graceful fallback until verified map routing exists.
"""

from __future__ import annotations

import uuid

from app.core.errors import ValidationError
from app.models.location import Location
from app.models.route import RouteInstruction, RouteRequest, RouteResult
from app.services.analytics.event_logger import log_event
from app.models.analytics import AnalyticsEventRequest
from app.services.journey import state_manager
from app.services.locations import location_service


def _resolve_optional(location_id: str | None) -> Location | None:
    if not location_id:
        return None
    return location_service.get_location(location_id)


def _destination_from_session(session_id: str | None) -> str | None:
    if not session_id:
        return None
    session = state_manager.get_session(session_id)
    return session.next_action.target_location_id or session.next_action.target_room


def _build_text_steps(start: Location | None, destination: Location) -> list[RouteInstruction]:
    steps: list[str] = []
    if start is None:
        steps.append("Bác bắt đầu từ vị trí hiện tại hoặc hỏi quầy hướng dẫn gần nhất.")
    elif start.floor_number == destination.floor_number:
        steps.append(
            f"Từ {start.poi_id}, bác đi theo biển chỉ dẫn trong {start.area}."
        )
    else:
        steps.append(
            f"Từ {start.poi_id}, bác đi tới thang máy hoặc cầu thang gần nhất."
        )
        steps.append(f"Bác di chuyển lên tầng {destination.floor_number}.")

    steps.append(
        f"Đi tới {destination.label}. Khu vực: {destination.area}."
    )
    steps.append("Nếu không thấy biển phòng, bác hỏi nhân viên trực tại khu vực đó.")

    return [
        RouteInstruction(step=index + 1, text=text, text_vi=text)
        for index, text in enumerate(steps)
    ]


def get_route(request: RouteRequest) -> RouteResult:
    """Return text directions to the requested destination."""
    destination_id = request.destination_location_id or _destination_from_session(request.session_id)
    if not destination_id:
        raise ValidationError("destination_location_id is required when the session has no navigation target")

    start = _resolve_optional(request.start_location_id)
    destination = location_service.get_location(destination_id)
    instructions = _build_text_steps(start, destination)
    result = RouteResult(
        route_id="route_stub_" + uuid.uuid4().hex[:12],
        start_location_id=start.location_id if start else request.start_location_id,
        destination_location_id=destination.location_id,
        start_room=start.poi_id if start else None,
        destination_room=destination.poi_id,
        map_available=False,
        instructions=instructions,
        estimated_seconds=max(90, len(instructions) * 45),
    )

    log_event(
        AnalyticsEventRequest(
            event_type="route_requested",
            session_id=request.session_id,
            metadata={
                "start_location_id": result.start_location_id or "",
                "destination_location_id": result.destination_location_id,
                "map_available": False,
            },
        )
    )
    return result
