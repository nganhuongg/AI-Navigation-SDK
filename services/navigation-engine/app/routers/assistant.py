"""Assistant endpoint: ask a question, get a grounded Vietnamese reply."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.assistant import AssistantRequest
from app.models.common import APIResponse
from app.services.assistant import assistant_service

router = APIRouter(tags=["assistant"])


@router.post("/assistant/ask")
def ask(request: AssistantRequest) -> APIResponse:
    """Send a user message → return intent + Vietnamese response."""
    result = assistant_service.ask(request.message, request.session_id)
    return APIResponse.ok(result.model_dump())
