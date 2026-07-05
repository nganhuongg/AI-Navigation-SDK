"""SmartBot conversational proxy models."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class ChatbotMetadata(BaseModel):
    current_step: Optional[str] = None
    target_room: Optional[str] = None
    target_floor: Optional[str] = None
    next_action: Optional[str] = None
    accessibility_mode: Optional[str] = None


class ChatbotMessageRequest(BaseModel):
    session_id: str
    sender_id: str
    text: str
    metadata: ChatbotMetadata = Field(default_factory=ChatbotMetadata)


class ChatbotMessageResponse(BaseModel):
    reply_text: str
    cards: list[dict[str, Any]] = Field(default_factory=list)
    intent_name: Optional[str] = None
    handoff_required: bool = False
