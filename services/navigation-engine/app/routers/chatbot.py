"""SmartBot proxy endpoint used by frontend apps."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.chatbot import ChatbotMessageRequest
from app.models.common import APIResponse
from app.services.chatbot import smartbot_proxy

router = APIRouter(tags=["chatbot"])


@router.post("/api/chatbot/message")
def message(request: ChatbotMessageRequest) -> APIResponse:
    """Send a safe session-scoped message to VNPT SmartBot."""
    result = smartbot_proxy.send_message(request)
    return APIResponse.ok(result.model_dump())
