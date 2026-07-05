"""Assistant orchestrator: redact → classify → safety check → build reply.

Flow for POST /assistant/ask:
  1. Redact PII from the message (Data Protection Layer).
  2. Classify intent via the SmartBot adapter (real or mock).
  3. If the intent is unsafe (medical advice), return the safe refusal.
  4. Otherwise build a grounded reply from hospital data + the session.
"""

from __future__ import annotations

from typing import Optional

from app.adapters import mock_bot, vnpt_smartbot
from app.core.config import settings
from app.core.errors import NotFoundError
from app.models.assistant import AssistantResponse
from app.models.session import SessionContext
from app.services.assistant import response_builder, safety_fallback
from app.services.journey import state_manager
from app.services.privacy import redactor
from app.storage import runtime_store


def _get_bot_adapter():
    """Real SmartBot when enabled, otherwise the mock (demo default)."""
    if settings.use_vnpt_smartbot:
        return vnpt_smartbot
    return mock_bot


def _load_session(session_id: Optional[str]) -> Optional[SessionContext]:
    if not session_id:
        return None
    try:
        return state_manager.get_session(session_id)
    except NotFoundError:
        return None


def ask(message: str, session_id: Optional[str] = None) -> AssistantResponse:
    """Answer a patient's question."""
    clean_message = redactor.redact_text(message)
    session = _load_session(session_id)

    intent, confidence = _get_bot_adapter().classify(clean_message, session)

    refusal = safety_fallback.check(intent)
    if refusal is not None:
        return AssistantResponse(
            intent=intent,
            response_text=refusal,
            confidence=confidence,
            is_fallback=True,
        )

    reply = response_builder.build(intent, clean_message, session, confidence)

    # Remember the last intent on the session (best-effort; never breaks the reply).
    if session is not None:
        try:
            session.last_user_intent = intent
            runtime_store.save_session(session.model_dump())
        except Exception:
            pass

    return reply
