"""Pydantic model for a hospital location / point of interest (POI).

Mirrors one entry in ``data/reference/locations.json``. Field names match the
JSON exactly so parsing is a direct ``Location(**entry)``.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class Location(BaseModel):
    location_id: str          # e.g. "loc_A303" (internal stable id)
    poi_id: str               # e.g. "A303" (room code shown to patients)
    hospital_id: str
    building_id: str
    floor_id: str
    floor_number: int
    department_id: str
    area: str
    label: str                # "A303 - Phòng lấy máu 1"
    name: str                 # "Phòng lấy máu 1"
    function: str             # "Lấy mẫu"
    category: str
    poi_type: str             # "lab", "clinic", "elevator", ...
    opening_hours: str = ""
    is_patient_destination: bool = False
    wheelchair_access: str = ""
    voice_aliases: list[str] = Field(default_factory=list)
    ocr_keywords: list[str] = Field(default_factory=list)
    notes: str = ""
