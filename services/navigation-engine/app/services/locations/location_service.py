"""Read-only access to the hospital location catalog (locations.json).

The catalog is loaded once and cached in memory (it never changes at runtime).
"""

from __future__ import annotations

from typing import Any, Optional

from app.core.errors import NotFoundError
from app.core.paths import LOCATIONS_FILE
from app.models.location import Location
from app.storage.json_store import read_json

# Simple in-memory cache. The catalog is static during a run, so we read it once.
_locations_cache: Optional[list[Location]] = None


def _load() -> list[Location]:
    global _locations_cache
    if _locations_cache is None:
        payload: dict[str, Any] = read_json(LOCATIONS_FILE)
        _locations_cache = [Location(**entry) for entry in payload.get("locations", [])]
    return _locations_cache


def list_locations() -> list[Location]:
    """Return all locations for the demo hospital."""
    return _load()


def get_location(location_or_poi_id: str) -> Location:
    """Look up one location by its internal id (loc_A303) OR its room code (A303)."""
    for location in _load():
        if location.location_id == location_or_poi_id or location.poi_id == location_or_poi_id:
            return location
    raise NotFoundError(f"Location not found: {location_or_poi_id}")
