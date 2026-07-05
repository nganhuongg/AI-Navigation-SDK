"""Match free-text (what a patient says/types) to a hospital location.

Normalizes Vietnamese text (accent-insensitive) and scores each location by how
well the query overlaps its name, room code, function, and the ``voice_aliases`` /
``ocr_keywords`` lists.

It also expands a few common colloquial synonyms so everyday phrasing works —
e.g. "thử máu" (colloquial) resolves to the blood-test room even though the data
uses "lấy máu". This mirrors the vòng-1 §3.4.2 goal of understanding natural,
imprecise questions. A fuller intent-aware version can replace this later.
"""

from __future__ import annotations

from typing import Optional

from app.core.text import normalize_vi
from app.models.location import Location
from app.services.locations.location_service import list_locations

# Score weights (named so there are no "magic numbers").
EXACT_MATCH_SCORE = 1.0
CONTAINMENT_BASE = 0.2
CONTAINMENT_WEIGHT = 0.6

# Colloquial phrase (normalized) -> a short canonical term that appears in the data.
# Keys/values are already accent-stripped to match normalize_vi output.
SYNONYMS: dict[str, str] = {
    "thu mau": "lay mau",       # "thử máu" -> blood collection (A303/A304)
    "thu tieu": "nuoc tieu",    # "thử tiểu" -> urine test
    "chup chieu": "x quang",    # "chụp chiếu" -> X-ray
}


def _queries_for(query: str) -> list[str]:
    """Normalized query plus any colloquial-synonym canonical terms it triggers.

    Each synonym is a SEPARATE short query (not appended), so the containment
    scorer can still match short room terms like "lay mau".
    """
    base = normalize_vi(query)
    queries = [base]
    queries += [value for key, value in SYNONYMS.items() if key in base]
    return queries


def _score(query_norm: str, candidate: str) -> float:
    """Score one candidate string against the normalized query."""
    cand = normalize_vi(candidate)
    if not cand or not query_norm:
        return 0.0
    if cand == query_norm:
        return EXACT_MATCH_SCORE
    if cand in query_norm or query_norm in cand:
        overlap_ratio = min(len(cand), len(query_norm)) / max(len(cand), len(query_norm))
        return CONTAINMENT_BASE + CONTAINMENT_WEIGHT * overlap_ratio
    return 0.0


def match_location(query: str) -> Optional[dict]:
    """Return {"location": Location, "score": float} for the best match, or None."""
    queries = _queries_for(query)
    query_norm = normalize_vi(query)
    best_location: Optional[Location] = None
    best_score = 0.0

    for location in list_locations():
        candidates = [location.name, location.poi_id, location.function]
        candidates += location.voice_aliases
        candidates += location.ocr_keywords

        # Best score of any candidate string against any of the query variants.
        location_best = max(
            (_score(q, c) for q in queries for c in candidates),
            default=0.0,
        )
        if location.poi_type == "registration" and (
            "dang ky" in query_norm or "tiep nhan" in query_norm or "quay dang ky" in query_norm
        ):
            location_best = max(location_best, 0.65)
        if location.poi_type == "guidance" and ("quay huong dan" in query_norm or "tiep tan" in query_norm):
            location_best = max(location_best, 0.65)
        if location_best > best_score:
            best_score = location_best
            best_location = location

    if best_location is None or best_score == 0.0:
        return None
    return {"location": best_location, "score": round(best_score, 3)}
