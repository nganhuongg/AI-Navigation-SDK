"""Load care journey templates from data/reference/care_journey_templates/.

Templates are static reference data. The list view returns small summaries; the
detail view returns the full document (used later to seed a patient session).
"""

from __future__ import annotations

import re
from typing import Any

from app.core.errors import EngineError, NotFoundError
from app.core.paths import CARE_JOURNEY_TEMPLATES_DIR
from app.models.session import PatientJourney, SpecializedProcess
from app.storage.json_store import read_json, write_json

SNAKE_CASE_RE = re.compile(r"^[a-z][a-z0-9_]*$")

REQUIRED_TEMPLATE_KEYS = {
    "template_id",
    "version",
    "template_type",
    "name",
    "description",
    "source_basis",
    "privacy",
    "update_modes",
    "patient_journey_template",
    "specialized_process_blueprint",
    "fallbacks",
}


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


def update_template(template_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Validate and persist one care journey template."""
    _validate_template_update(template_id, payload)
    path = CARE_JOURNEY_TEMPLATES_DIR / f"{template_id}.json"
    if not path.exists():
        raise NotFoundError(f"Journey template not found: {template_id}")
    write_json(path, payload)
    return payload


def _validate_template_update(template_id: str, payload: dict[str, Any]) -> None:
    if not isinstance(payload, dict):
        raise EngineError("Template payload must be a JSON object.", status_code=422)

    missing = sorted(REQUIRED_TEMPLATE_KEYS - set(payload.keys()))
    if missing:
        raise EngineError(f"Template is missing required fields: {', '.join(missing)}", status_code=422)

    if payload.get("template_id") != template_id:
        raise EngineError("Template id in URL and body must match.", status_code=422)
    if payload.get("template_type") != "blank_patient_journey":
        raise EngineError("Only blank_patient_journey templates can be edited here.", status_code=422)

    try:
        PatientJourney(**payload["patient_journey_template"])
        SpecializedProcess(**payload["specialized_process_blueprint"])
    except Exception as exc:
        raise EngineError(f"Template patient journey or service blueprint is invalid: {exc}", status_code=422) from exc

    fallbacks = payload.get("fallbacks")
    if not isinstance(fallbacks, list) or not fallbacks:
        raise EngineError("Template must define at least one fallback rule.", status_code=422)
    for fallback in fallbacks:
        if not all(str(fallback.get(key, "")).strip() for key in ("fallback_id", "trigger", "message_vi")):
            raise EngineError("Each fallback needs fallback_id, trigger, and message_vi.", status_code=422)

    privacy = payload.get("privacy", {})
    allowed_fields = privacy.get("allowed_extracted_fields")
    if not isinstance(allowed_fields, list) or not allowed_fields:
        raise EngineError("Privacy settings must include allowed extracted fields.", status_code=422)

    service_columns = privacy.get("ocr_service_columns")
    if service_columns is None:
        return
    if not isinstance(service_columns, list) or not service_columns:
        raise EngineError("OCR service columns must be a non-empty list when provided.", status_code=422)

    seen_keys: set[str] = set()
    for column in service_columns:
        if not isinstance(column, dict):
            raise EngineError("Each OCR service column must be an object.", status_code=422)
        key = str(column.get("key", "")).strip()
        label = str(column.get("label", "")).strip()
        description = str(column.get("description", "")).strip()
        if not key or not label or not description:
            raise EngineError("Each OCR service column needs key, label, and description.", status_code=422)
        if not SNAKE_CASE_RE.match(key):
            raise EngineError("OCR service column keys must use snake_case.", status_code=422)
        if key in seen_keys:
            raise EngineError("OCR service column keys must be unique.", status_code=422)
        seen_keys.add(key)
