"""Route request and text-stub response models."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class RouteRequest(BaseModel):
    session_id: Optional[str] = None
    start_location_id: Optional[str] = None
    destination_location_id: Optional[str] = None


class RouteInstruction(BaseModel):
    step: int
    text: str
    text_vi: str


class RouteResult(BaseModel):
    route_id: str
    start_location_id: Optional[str] = None
    destination_location_id: str
    start_room: Optional[str] = None
    destination_room: str
    map_available: bool = False
    instructions: list[RouteInstruction] = Field(default_factory=list)
    estimated_seconds: int
    node_path: list[str] = Field(default_factory=list)
    polyline: list[dict[str, float]] = Field(default_factory=list)
