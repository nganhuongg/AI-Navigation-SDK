"""Admin map builder and verified-map read APIs."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.models.common import APIResponse
from app.models.map import ConfirmMapRequest, DigitizeMapRequest, NodeAnchorUpdateRequest, RoutePreviewRequest
from app.models.route import RouteRequest
from app.services.map_digitization import digitizer
from app.services.routing import graph_router

router = APIRouter(prefix="/maps", tags=["maps"])


@router.get("")
def list_maps() -> APIResponse:
    return APIResponse.ok([item.model_dump() for item in digitizer.list_maps()])


@router.post("/digitize")
def digitize_map(request: DigitizeMapRequest) -> APIResponse:
    digital_map = digitizer.digitize_map(request)
    return APIResponse.ok(digital_map.model_dump())


@router.get("/{map_id}")
def get_map(map_id: str) -> APIResponse:
    digital_map = digitizer.load_map(map_id)
    return APIResponse.ok(digital_map.model_dump())


@router.get("/{map_id}/verified")
def get_verified_map(map_id: str) -> APIResponse:
    digital_map = digitizer.load_map(map_id, status="verified")
    return APIResponse.ok(digital_map.model_dump())


@router.post("/{map_id}/confirm")
def confirm_map(map_id: str) -> APIResponse:
    digital_map = digitizer.confirm_map(map_id)
    return APIResponse.ok(digital_map.model_dump())


@router.post("/confirm")
def confirm_map_body(request: ConfirmMapRequest) -> APIResponse:
    digital_map = digitizer.confirm_map(request.map_id)
    return APIResponse.ok(digital_map.model_dump())


@router.patch("/{map_id}/nodes/{node_id}")
def update_node_anchor(map_id: str, node_id: str, request: NodeAnchorUpdateRequest) -> APIResponse:
    digital_map = digitizer.update_node_anchor(map_id, node_id, request)
    return APIResponse.ok(digital_map.model_dump())


@router.post("/{map_id}/route-preview")
def route_preview(map_id: str, request: RoutePreviewRequest) -> APIResponse:
    route_request = RouteRequest(
        session_id=request.session_id,
        start_location_id=request.start_location_id,
        destination_location_id=request.destination_location_id,
    )
    result = graph_router.get_route_for_map(map_id, route_request, status=request.map_status)
    return APIResponse.ok(result.model_dump())


@router.get("/{map_id}/floor/{floor_number}/image")
def get_floor_image(map_id: str, floor_number: int) -> FileResponse:
    return FileResponse(digitizer.get_floor_image_path(map_id, floor_number), media_type="image/png")
