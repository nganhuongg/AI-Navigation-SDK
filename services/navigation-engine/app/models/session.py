"""Session + patient-journey models.

These mirror the authoritative shape: ``shared-types/journey.ts`` /
``care_journey_template.schema.json`` / ``standard_outpatient_v1.json``.

A **session** is a runtime copy of the template's ``patient_journey`` (the
``PatientJourney`` model below) wrapped in a small envelope (id, timestamps,
expiry) plus a computed, structured ``next_action`` for the frontend.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Pieces of the patient journey (match the JSON schema exactly) ─────────────
class JourneyCheckpoint(BaseModel):
    room: str
    location_code: str
    floor: int
    is_done: bool = False
    completed_at: Optional[str] = None


class ExtractedFields(BaseModel):
    specialty: Optional[str] = None
    initial_exam_room: Optional[str] = None
    ordered_services: list[str] = Field(default_factory=list)
    detected_room_codes: list[str] = Field(default_factory=list)
    room_descriptions: dict[str, str] = Field(default_factory=dict)
    room_notes: dict[str, str] = Field(default_factory=dict)
    room_queue_numbers: dict[str, str] = Field(default_factory=dict)
    return_room: Optional[str] = None
    queue_number: Optional[str | int] = None
    completed_steps: list[str] = Field(default_factory=list)
    source: Optional[str] = None


class SpecializedService(BaseModel):
    service_id: str
    service_name: str
    description: str
    department: str
    room: str
    room_name: str
    building: str
    floor: int
    estimated_duration_minutes: int
    status: Literal["pending", "in_progress", "completed", "skipped"] = "pending"
    completed_at: Optional[str] = None
    next_step: Optional[str] = None


class SpecializedProcess(BaseModel):
    services: list[SpecializedService] = Field(default_factory=list)
    return_room: Optional[str] = None


class PatientJourney(BaseModel):
    patient_id: Optional[str] = None
    session_id: Optional[str] = None
    register: JourneyCheckpoint
    identity: JourneyCheckpoint
    payment: JourneyCheckpoint
    specialized_process_updated: bool = False
    specialized_process: Optional[SpecializedProcess] = None
    extracted_fields: ExtractedFields = Field(default_factory=ExtractedFields)
    current_step: str = "waiting_for_doctor"
    # Human-readable next action string (kept for template fidelity).
    next_action: Optional[str] = None
    confidence_score: Optional[float] = None
    requires_user_confirmation: bool = False


# ── Session envelope + structured next action (for the frontend) ─────────────
NextActionType = Literal["navigate", "scan", "confirm", "wait", "done"]


class NextAction(BaseModel):
    """Structured version of the next action, richer than the journey's string."""

    type: NextActionType
    target_location_id: Optional[str] = None  # e.g. "loc_A303"
    target_room: Optional[str] = None         # e.g. "A303"
    message: str


class SessionContext(BaseModel):
    session_id: str
    template_id: str
    created_at: str
    expires_at: str
    current_location: Optional[str] = None    # room code, if the patient tells us
    last_user_intent: Optional[str] = None
    journey: PatientJourney
    next_action: NextAction


# ── Request bodies ───────────────────────────────────────────────────────────
class SessionStartRequest(BaseModel):
    template_id: str = "standard_outpatient_v1"


ExtractedFieldSource = Literal["ocr", "hospital_api", "manual"]


class ConfirmOcrFields(BaseModel):
    """The subset of fields OCR fills (per template update_mode paper_form_ocr)."""

    initial_exam_room: Optional[str] = None
    ordered_services: list[str] = Field(default_factory=list)
    detected_room_codes: list[str] = Field(default_factory=list)
    room_descriptions: dict[str, str] = Field(default_factory=dict)
    room_notes: dict[str, str] = Field(default_factory=dict)
    room_queue_numbers: dict[str, str] = Field(default_factory=dict)
    return_room: Optional[str] = None
    specialty: Optional[str] = None
    queue_number: Optional[str | int] = None
    completed_steps: list[str] = Field(default_factory=list)


class ConfirmOcrRequest(BaseModel):
    fields: ConfirmOcrFields
    confidence: Optional[float] = None


class ApplyExtractedFieldsRequest(BaseModel):
    """Confirmed journey fields from OCR, hospital API, or manual correction."""

    fields: ConfirmOcrFields
    confidence: Optional[float] = None
    source: ExtractedFieldSource = "manual"
