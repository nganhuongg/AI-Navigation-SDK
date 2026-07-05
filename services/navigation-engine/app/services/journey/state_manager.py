"""Create and update patient sessions (the journey state machine).

A session is created from a care journey template, then advanced by two events:
  - confirm_ocr(): fill the specialized process from the scanned instruction form
  - arrive():      mark the current step done and move to the next

After every change we recompute the structured ``next_action`` and save.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.errors import EngineError, NotFoundError
from app.core.security import new_session_id
from app.models.session import (
    ConfirmOcrFields,
    ExtractedFieldSource,
    NextAction,
    PatientJourney,
    SessionContext,
    SpecializedService,
    SpecializedProcess,
)
from app.services.journey import template_loader
from app.services.journey.next_action import (
    FIXED_CHECKPOINTS,
    INITIAL_EXAM_STEP,
    compute_next_action,
)
from app.services.locations import location_service
from app.storage import runtime_store

# Standard closing steps always appended after the OCR-ordered CLS tests.
# The instruction form (phiếu chỉ định) lists the lab/imaging tests; returning to
# the doctor and collecting medicine are implicit standard steps every outpatient
# does. See standard_outpatient_v1.json (example_after_update keeps all four).
STANDARD_TAIL_SERVICES: tuple[str, ...] = ("return_doctor", "pharmacy")

DEFAULT_SESSION_TTL_MINUTES = 480


def _now_hhmm() -> str:
    """Wall-clock HH:MM, matching the template's completed_at format."""
    return datetime.now().strftime("%H:%M")


def _recompute(journey: PatientJourney) -> NextAction:
    """Recompute current_step + next_action and write them back onto the journey."""
    step_id, action = compute_next_action(journey)
    journey.current_step = step_id
    journey.next_action = action.message  # keep the template's string field in sync
    return action


def _append_completed(journey: PatientJourney, step_id: str) -> None:
    """Record a finished step id in extracted_fields.completed_steps (no dupes)."""
    if step_id not in journey.extracted_fields.completed_steps:
        journey.extracted_fields.completed_steps.append(step_id)


def _mark_completed_steps(journey: PatientJourney, completed_steps: list[str]) -> None:
    """Apply externally confirmed completed steps to checkpoints/services."""
    for step_id in completed_steps:
        _append_completed(journey, step_id)

        if step_id in FIXED_CHECKPOINTS:
            checkpoint = getattr(journey, step_id)
            checkpoint.is_done = True
            if checkpoint.completed_at is None:
                checkpoint.completed_at = _now_hhmm()
            continue

        if journey.specialized_process is None:
            continue

        for service in journey.specialized_process.services:
            if service.service_id == step_id:
                service.status = "completed"
                if service.completed_at is None:
                    service.completed_at = _now_hhmm()
                break


def start_session(template_id: str) -> SessionContext:
    """Create a new anonymous session from a care journey template."""
    template = template_loader.get_template(template_id)

    journey = PatientJourney(**template["patient_journey_template"])
    session_id = new_session_id()
    journey.session_id = session_id

    ttl_minutes = template.get("privacy", {}).get(
        "session_ttl_minutes", DEFAULT_SESSION_TTL_MINUTES
    )
    created = datetime.now(timezone.utc)
    expires = created + timedelta(minutes=ttl_minutes)

    action = _recompute(journey)
    session = SessionContext(
        session_id=session_id,
        template_id=template_id,
        created_at=created.isoformat(),
        expires_at=expires.isoformat(),
        current_location=None,
        last_user_intent=None,
        journey=journey,
        next_action=action,
    )
    runtime_store.save_session(session.model_dump())
    return session


def _parse_expires_at(value: str) -> datetime:
    """Parse the stored ISO timestamp, accepting both +00:00 and Z suffixes."""
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _is_expired(session: SessionContext) -> bool:
    return _parse_expires_at(session.expires_at) <= datetime.now(timezone.utc)


def get_session(session_id: str) -> SessionContext:
    """Load a session from disk (raises NotFoundError if missing)."""
    session = SessionContext(**runtime_store.load_session(session_id))
    if _is_expired(session):
        runtime_store.delete_session(session_id)
        raise EngineError("Session expired. Please start a new session.", status_code=410)
    return session


def _build_specialized_process(
    blueprint: SpecializedProcess, ordered_services: list[str]
) -> SpecializedProcess:
    """Build the per-patient service list from the blueprint.

    Included = the OCR-ordered CLS tests + the standard tail (return_doctor,
    pharmacy). Blueprint order is preserved, and next_step links are re-chained
    to reflect exactly the included services.
    """
    included = list(ordered_services) + [
        service_id
        for service_id in STANDARD_TAIL_SERVICES
        if service_id not in ordered_services
    ]

    services = []
    for service in blueprint.services:
        if service.service_id in included:
            fresh = service.model_copy(deep=True)
            fresh.status = "pending"
            fresh.completed_at = None
            services.append(fresh)

    # Re-link next_step to point at the following included service (or None).
    for index, service in enumerate(services):
        service.next_step = (
            services[index + 1].service_id if index + 1 < len(services) else None
        )

    return SpecializedProcess(services=services, return_room=blueprint.return_room)


def _estimated_duration_for_poi_type(poi_type: str) -> int:
    """Small catalog-based default so dynamic OCR steps are usable immediately."""
    if poi_type == "clinic":
        return 10
    if poi_type in {"lab", "imaging", "diagnostic"}:
        return 20
    if poi_type == "pharmacy":
        return 10
    return 15


def _dynamic_service_from_room(
    room_code: str,
    room_descriptions: dict[str, str],
    room_notes: dict[str, str],
) -> SpecializedService | None:
    """Create a journey service directly from a room/location catalog entry."""
    try:
        location = location_service.get_location(room_code)
    except NotFoundError:
        return None

    form_description = room_descriptions.get(location.poi_id) or room_descriptions.get(room_code)
    form_note = room_notes.get(location.poi_id) or room_notes.get(room_code)
    service_label = form_description or location.function or location.name
    description = form_description or location.function or f"Di chuyen den {location.label}"
    if form_note:
        if form_description and form_note.startswith(form_description):
            description = form_note
        else:
            description = f"{description}. Ghi chu: {form_note}"

    return SpecializedService(
        service_id=f"room_{location.poi_id}",
        service_name=service_label,
        description=description,
        department=location.category or location.area,
        room=location.poi_id,
        room_name=location.name,
        building=location.building_id,
        floor=location.floor_number,
        estimated_duration_minutes=_estimated_duration_for_poi_type(location.poi_type),
        status="pending",
        completed_at=None,
        next_step=None,
    )


def _build_specialized_process_from_rooms(
    blueprint: SpecializedProcess,
    room_codes: list[str],
    room_descriptions: dict[str, str],
    room_notes: dict[str, str],
) -> SpecializedProcess:
    """Build the care journey directly from OCR-detected room codes.

    The OCR order is preserved. Each room is enriched from locations.json so the
    UI can show the room name, function, department/category, and floor. This is
    used for real paper forms that mention rooms not pre-modeled in the small
    demo blueprint.
    """
    services: list[SpecializedService] = []
    seen_rooms: set[str] = set()

    for room_code in room_codes:
        normalized = room_code.upper()
        if normalized in seen_rooms:
            continue
        seen_rooms.add(normalized)
        service = _dynamic_service_from_room(normalized, room_descriptions, room_notes)
        if service is not None:
            services.append(service)

    # Keep the template's standard pharmacy tail unless OCR already included it.
    pharmacy = next(
        (service for service in blueprint.services if service.service_id == "pharmacy"),
        None,
    )
    if pharmacy is not None and pharmacy.room.upper() not in seen_rooms:
        services.append(pharmacy.model_copy(deep=True))

    for index, service in enumerate(services):
        service.status = "pending"
        service.completed_at = None
        service.next_step = (
            services[index + 1].service_id if index + 1 < len(services) else None
        )

    return SpecializedProcess(
        services=services,
        return_room=room_codes[-1] if room_codes else blueprint.return_room,
    )


def apply_extracted_fields(
    session_id: str,
    fields: ConfirmOcrFields,
    confidence: float | None = None,
    source: ExtractedFieldSource = "manual",
) -> SessionContext:
    """Apply confirmed extracted fields and recompute the patient's next action."""
    session = get_session(session_id)
    journey = session.journey
    extracted = journey.extracted_fields

    # Copy over fields from a confirmed source: OCR, hospital API, or manual edit.
    if fields.initial_exam_room is not None:
        extracted.initial_exam_room = fields.initial_exam_room
    if fields.ordered_services:
        extracted.ordered_services = fields.ordered_services
    if fields.detected_room_codes:
        extracted.detected_room_codes = fields.detected_room_codes
    if fields.room_descriptions:
        extracted.room_descriptions = fields.room_descriptions
    if fields.room_notes:
        extracted.room_notes = fields.room_notes
    if fields.room_queue_numbers:
        extracted.room_queue_numbers = fields.room_queue_numbers
    if fields.return_room is not None:
        extracted.return_room = fields.return_room
    if fields.specialty is not None:
        extracted.specialty = fields.specialty
    if fields.queue_number is not None:
        extracted.queue_number = fields.queue_number
    extracted.source = source

    template = template_loader.get_template(session.template_id)
    blueprint = SpecializedProcess(**template["specialized_process_blueprint"])
    if extracted.detected_room_codes:
        journey.specialized_process = _build_specialized_process_from_rooms(
            blueprint,
            extracted.detected_room_codes,
            extracted.room_descriptions,
            extracted.room_notes,
        )
    else:
        journey.specialized_process = _build_specialized_process(
            blueprint, extracted.ordered_services
        )
    journey.specialized_process_updated = True
    journey.requires_user_confirmation = False
    if confidence is not None:
        journey.confidence_score = confidence
    if fields.completed_steps:
        _mark_completed_steps(journey, fields.completed_steps)

    session.next_action = _recompute(journey)
    runtime_store.save_session(session.model_dump())
    return session


def confirm_ocr(
    session_id: str, fields: ConfirmOcrFields, confidence: float | None = None
) -> SessionContext:
    """Apply fields after the user confirms OCR extraction."""
    return apply_extracted_fields(session_id, fields, confidence, source="ocr")


def arrive(session_id: str) -> SessionContext:
    """Mark the patient's current step complete and advance to the next."""
    session = get_session(session_id)
    journey = session.journey

    # Recompute the step the patient is currently at (source of truth = state).
    current_step, _ = compute_next_action(journey)

    if current_step in FIXED_CHECKPOINTS:
        checkpoint = getattr(journey, current_step)
        checkpoint.is_done = True
        checkpoint.completed_at = _now_hhmm()
        _append_completed(journey, current_step)

    elif current_step == INITIAL_EXAM_STEP:
        # Cannot advance the initial exam without scanning the instruction form.
        # Leave state unchanged; next_action still prompts the patient to scan.
        pass

    elif current_step == "done":
        # Already finished; nothing to advance.
        pass

    else:
        # A specialized service: mark it completed.
        if journey.specialized_process is not None:
            for service in journey.specialized_process.services:
                if service.service_id == current_step:
                    service.status = "completed"
                    service.completed_at = _now_hhmm()
                    break
        _append_completed(journey, current_step)

    session.next_action = _recompute(journey)
    runtime_store.save_session(session.model_dump())
    return session
