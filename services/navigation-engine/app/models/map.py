"""Digital map models used by admin map builder and patient routing."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


MapStatus = Literal["draft", "verified"]
NodeKind = Literal["corridor", "room", "elevator", "stairs"]
EdgeKind = Literal["walkway", "door", "elevator", "stairs"]


class MapFloor(BaseModel):
    floor_id: str
    floor_number: int
    image_width: int
    image_height: int
    source_image: str


class MapNode(BaseModel):
    node_id: str
    x: float
    y: float
    floor_number: int
    kind: NodeKind
    location_id: Optional[str] = None
    poi_id: Optional[str] = None
    label: Optional[str] = None


class MapEdge(BaseModel):
    edge_id: str
    from_node: str
    to_node: str
    weight: float
    kind: EdgeKind = "walkway"


class MapPOI(BaseModel):
    poi_id: str
    location_id: str
    node_id: str
    label: str
    x: float
    y: float
    floor_number: int


class DigitalMap(BaseModel):
    map_id: str
    hospital_id: str
    building_id: str
    status: MapStatus
    version: int = 1
    floors: list[MapFloor] = Field(default_factory=list)
    nodes: list[MapNode] = Field(default_factory=list)
    edges: list[MapEdge] = Field(default_factory=list)
    pois: list[MapPOI] = Field(default_factory=list)
    created_at: str
    verified_at: Optional[str] = None


class DigitizeMapRequest(BaseModel):
    map_id: Optional[str] = None
    floor_numbers: list[int] = Field(default_factory=lambda: [1, 2, 3])
    source_image_pattern: str = "map-floor{floor}.png"


class ConfirmMapRequest(BaseModel):
    map_id: str


class NodeAnchorUpdateRequest(BaseModel):
    x: float
    y: float
    status: MapStatus = "draft"


class RoutePreviewRequest(BaseModel):
    session_id: str | None = None
    start_location_id: str
    destination_location_id: str
    map_status: MapStatus = "draft"


class MapListItem(BaseModel):
    map_id: str
    status: MapStatus
    version: int
    floor_count: int
    node_count: int
    edge_count: int
    poi_count: int
    created_at: str
    verified_at: Optional[str] = None
