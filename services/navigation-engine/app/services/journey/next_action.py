"""Compute "what should the patient do next?" from a patient journey.

This is the heart of the journey brain. It walks the fixed sequence of steps and
returns the first one that is not finished, as a structured NextAction the
frontend can render (and, later, speak).

Step sequence:
    register (A101) -> identity (A103) -> payment (A115)
      -> initial exam / waiting_for_doctor  (advance by confirming OCR)
      -> each specialized_process service in order
      -> done
"""

from __future__ import annotations

from app.core.errors import NotFoundError
from app.models.location import Location
from app.models.session import NextAction, PatientJourney
from app.services.locations import location_service

# The three fixed reception checkpoints, in order, as (journey attribute, step id).
FIXED_CHECKPOINTS: list[str] = ["register", "identity", "payment"]

# The step id used while the patient is at / waiting for the initial doctor exam.
INITIAL_EXAM_STEP = "waiting_for_doctor"


def _resolve(room_code: str) -> Location | None:
    """Look up a Location by room code (A303); return None if unknown."""
    try:
        return location_service.get_location(room_code)
    except NotFoundError:
        return None


def compute_next_action(journey: PatientJourney) -> tuple[str, NextAction]:
    """Return (current_step_id, NextAction) for the given journey state."""

    # 1) Reception checkpoints: register -> identity -> payment.
    for step_id in FIXED_CHECKPOINTS:
        checkpoint = getattr(journey, step_id)
        if not checkpoint.is_done:
            location = _resolve(checkpoint.location_code)
            return step_id, NextAction(
                type="navigate",
                target_location_id=location.location_id if location else None,
                target_room=checkpoint.location_code,
                message=f"Bác đến {checkpoint.room} ({checkpoint.location_code}) để tiếp tục thủ tục.",
            )

    # 2) Initial exam. Until the instruction form is scanned/confirmed we do not
    #    know the ordered tests, so we prompt the patient to scan the phiếu.
    if not journey.specialized_process_updated or journey.specialized_process is None:
        return INITIAL_EXAM_STEP, NextAction(
            type="scan",
            target_location_id=None,
            target_room=journey.extracted_fields.initial_exam_room,
            message=(
                "Bác vào khám ban đầu. Khám xong, bác chụp phiếu chỉ định "
                "để cháu hướng dẫn các bước tiếp theo."
            ),
        )

    # 3) Specialized services, in order. First non-completed service is current.
    for service in journey.specialized_process.services:
        if service.status != "completed":
            location = _resolve(service.room)
            return service.service_id, NextAction(
                type="navigate",
                target_location_id=location.location_id if location else None,
                target_room=service.room,
                message=f"Bác đến phòng {service.room} ({service.room_name}) để {service.service_name.lower()}.",
            )

    # 4) Everything is done.
    return "done", NextAction(
        type="done",
        target_location_id=None,
        target_room=None,
        message="Bác đã hoàn thành hành trình khám. Chúc bác mau khỏe!",
    )
