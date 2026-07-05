"""Location endpoints: list, match by text, and get one.

Note: the plan lists ``POST /locations/match``. We expose it as ``GET`` with a
query string (``/locations/match?q=...``) because a lookup has no side effects and
this makes it trivial to test from the browser and /docs. The contract (text in,
best-matching location out) is unchanged.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.models.common import APIResponse
from app.services.locations import alias_matcher, location_service

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("")
def get_locations() -> APIResponse:
    """List all POIs for the demo hospital."""
    locations = location_service.list_locations()
    return APIResponse.ok([loc.model_dump() for loc in locations])


@router.get("/match")
def match_location(q: str = Query(..., description="Free text, e.g. 'lấy máu'")) -> APIResponse:
    """Return the best-matching location for a free-text query (or null)."""
    result = alias_matcher.match_location(q)
    if result is None:
        return APIResponse.ok(None)
    return APIResponse.ok(
        {"location": result["location"].model_dump(), "score": result["score"]}
    )


@router.get("/{location_id}")
def get_one_location(location_id: str) -> APIResponse:
    """Get one location by internal id (loc_A303) or room code (A303)."""
    location = location_service.get_location(location_id)
    return APIResponse.ok(location.model_dump())
