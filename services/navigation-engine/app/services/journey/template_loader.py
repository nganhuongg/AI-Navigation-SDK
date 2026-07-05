"""Load care journey templates from data/reference/care_journey_templates/.

Templates are static reference data. The list view returns small summaries; the
detail view returns the full document (used later to seed a patient session).
"""

from __future__ import annotations

from typing import Any

from app.core.errors import NotFoundError
from app.core.paths import CARE_JOURNEY_TEMPLATES_DIR
from app.storage.json_store import read_json


def _load_all() -> list[dict[str, Any]]:
    """Read every *.json template file in the templates directory."""
    if not CARE_JOURNEY_TEMPLATES_DIR.exists():
        return []
    return [read_json(path) for path in sorted(CARE_JOURNEY_TEMPLATES_DIR.glob("*.json"))]


def list_template_summaries() -> list[dict[str, Any]]:
    """Return a small summary per template (id, version, type, name)."""
    summaries: list[dict[str, Any]] = []
    for doc in _load_all():
        summaries.append(
            {
                "template_id": doc.get("template_id"),
                "version": doc.get("version"),
                "template_type": doc.get("template_type"),
                "name": doc.get("name"),
            }
        )
    return summaries


def get_template(template_id: str) -> dict[str, Any]:
    """Return the full template document for a given id."""
    for doc in _load_all():
        if doc.get("template_id") == template_id:
            return doc
    # Fall back to matching the filename (e.g. standard_outpatient_v1.json).
    candidate = CARE_JOURNEY_TEMPLATES_DIR / f"{template_id}.json"
    if candidate.exists():
        return read_json(candidate)
    raise NotFoundError(f"Journey template not found: {template_id}")
