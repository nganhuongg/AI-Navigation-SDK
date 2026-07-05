"""Route endpoint with verified-map routing and text fallback."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.errors import EngineError
from app.models.common import APIResponse
from app.models.route import RouteRequest
from app.services.routing import graph_router, route_stub

router = APIRouter(tags=["route"])


@router.post("/route")
def route(request: RouteRequest) -> APIResponse:
    """Return shortest-path map routing when a verified map exists."""
    try:
        result = graph_router.get_route(request)
    except EngineError:
        result = route_stub.get_route(request)
    return APIResponse.ok(result.model_dump())
