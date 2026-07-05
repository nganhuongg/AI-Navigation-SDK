"""Build the Vietnamese reply from an intent + session context.

Responses are always grounded in hospital data (locations + the patient's session)
— the assistant does not invent process or medical information (vòng-1 §3.2.2).
"""

from __future__ import annotations

from typing import Optional

from app.models.assistant import AssistantResponse
from app.models.session import SessionContext
from app.services.locations import alias_matcher

# Ignore weak location guesses below this score.
MIN_MATCH_SCORE = 0.3

_CLARIFY_MESSAGE = (
    "Cháu chưa hiểu rõ ý bác. Bác muốn hỏi đường đến phòng nào, "
    "hay hỏi bước khám tiếp theo ạ?"
)


def _clarify(intent: str, confidence: float) -> AssistantResponse:
    return AssistantResponse(
        intent=intent,
        response_text=_CLARIFY_MESSAGE,
        confidence=confidence,
        is_fallback=True,
    )


def build(
    intent: str,
    message: str,
    session: Optional[SessionContext],
    confidence: float,
) -> AssistantResponse:
    """Produce the assistant's answer for a (non-medical) intent."""

    if intent == "ask_route":
        match = alias_matcher.match_location(message)
        if match and match["score"] >= MIN_MATCH_SCORE:
            location = match["location"]
            return AssistantResponse(
                intent=intent,
                response_text=f"Bác đến phòng {location.poi_id} ({location.name}), tầng {location.floor_number} ạ.",
                confidence=confidence,
                is_fallback=False,
                target_location_id=location.location_id,
                target_room=location.poi_id,
            )
        return _clarify(intent, confidence)

    if intent == "ask_next_step":
        if session is not None:
            action = session.next_action
            return AssistantResponse(
                intent=intent,
                response_text=action.message,
                confidence=confidence,
                is_fallback=False,
                target_location_id=action.target_location_id,
                target_room=action.target_room,
            )
        return AssistantResponse(
            intent=intent,
            response_text=(
                "Bác cho cháu biết bác đang ở bước nào, hoặc chụp phiếu chỉ định "
                "để cháu hướng dẫn ạ."
            ),
            confidence=confidence,
            is_fallback=True,
        )

    if intent == "ask_current_status":
        if session is not None:
            action = session.next_action
            done = len(session.journey.extracted_fields.completed_steps)
            return AssistantResponse(
                intent=intent,
                response_text=f"Bác đã hoàn thành {done} bước. Việc tiếp theo: {action.message}",
                confidence=confidence,
                is_fallback=False,
                target_location_id=action.target_location_id,
                target_room=action.target_room,
            )
        return _clarify(intent, confidence)

    # unknown (or anything unhandled) → ask the patient to rephrase.
    return _clarify(intent, confidence)
