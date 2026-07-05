"""Session endpoints: start, get, confirm-ocr, arrive."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

from app.models.common import APIResponse
from app.models.session import (
    ApplyExtractedFieldsRequest,
    ConfirmOcrRequest,
    SessionStartRequest,
)
from app.services.journey import state_manager

router = APIRouter(prefix="/session", tags=["sessions"])


@router.post("/start")
def start_session(request: Optional[SessionStartRequest] = None) -> APIResponse:
    """Create a new anonymous session. Body is optional; defaults to the standard template."""
    template_id = request.template_id if request else "standard_outpatient_v1"
    session = state_manager.start_session(template_id)
    return APIResponse.ok(session.model_dump())


@router.get("/{session_id}")
def get_session(session_id: str) -> APIResponse:
    """Return the current session state."""
    return APIResponse.ok(state_manager.get_session(session_id).model_dump())


@router.post("/{session_id}/confirm-ocr")
def confirm_ocr(session_id: str, request: ConfirmOcrRequest) -> APIResponse:
    """Fill the journey from confirmed OCR fields and build the specialized process."""
    session = state_manager.confirm_ocr(session_id, request.fields, request.confidence)
    return APIResponse.ok(session.model_dump())


@router.post("/{session_id}/apply-extracted-fields")
def apply_extracted_fields(
    session_id: str, request: ApplyExtractedFieldsRequest
) -> APIResponse:
    """Apply confirmed fields from OCR, hospital API, or manual correction."""
    session = state_manager.apply_extracted_fields(
        session_id,
        request.fields,
        request.confidence,
        request.source,
    )
    return APIResponse.ok(session.model_dump())


@router.post("/{session_id}/arrive")
def arrive(session_id: str) -> APIResponse:
    """Mark the current step complete and advance to the next."""
    return APIResponse.ok(state_manager.arrive(session_id).model_dump())
