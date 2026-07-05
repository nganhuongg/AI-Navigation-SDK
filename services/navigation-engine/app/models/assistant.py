"""Assistant request/response models (mirror shared-types/assistant.ts)."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

IntentType = Literal[
    "ask_next_step",
    "ask_route",
    "ask_current_status",
    "out_of_scope_medical",
    "unknown",
]


class AssistantRequest(BaseModel):
    message: str
    session_id: Optional[str] = None  # optional: some questions need no session


class AssistantResponse(BaseModel):
    intent: str
    response_text: str
    confidence: float
    is_fallback: bool = False
    # When the answer points at a room, these help the UI offer a "chỉ đường" button.
    target_location_id: Optional[str] = None
    target_room: Optional[str] = None
