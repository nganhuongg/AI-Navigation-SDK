"""Real VNPT SmartBot adapter.

Used when USE_VNPT_SMARTBOT=true. We use SmartBot for intent recognition only;
the final patient-facing reply is still built from local hospital data by
response_builder, so medical/process content remains controlled by this backend.

VNPT request shape:
  POST https://assistant-stream.vnpt.vn/v1/conversation
  headers: Authorization, Token-id, Token-key, Content-Type
  JSON body: bot_id, sender_id, text, input_channel, session_id, metadata
"""

from __future__ import annotations

from typing import Any, Optional

import httpx

from app.core.config import settings
from app.core.errors import EngineError
from app.services.assistant import intent_classifier

REQUEST_TIMEOUT_SECONDS = 30.0

# Map VNPT SmartBot intent names -> our internal intent contract.
INTENT_MAP = {
    "ask_next_step": "ask_next_step",
    "next_step": "ask_next_step",
    "hoi_buoc_tiep_theo": "ask_next_step",
    "ask_route": "ask_route",
    "navigation": "ask_route",
    "location": "ask_route",
    "hoi_duong": "ask_route",
    "chi_duong": "ask_route",
    "ask_status": "ask_current_status",
    "status": "ask_current_status",
    "hoi_trang_thai": "ask_current_status",
    "medical": "out_of_scope_medical",
    "medical_advice": "out_of_scope_medical",
    "tu_van_y_te": "out_of_scope_medical",
}


def _auth_value() -> str:
    token = (
        settings.vnpt_access_token
        or settings.vnpt_smartbot_access_token
        or settings.vnpt_smartbot_api_key
    )
    if token.lower().startswith("bearer "):
        return token
    return f"Bearer {token}"


def _conversation_url() -> str:
    if settings.vnpt_smartbot_url:
        return settings.vnpt_smartbot_url
    base_url = settings.vnpt_smartbot_base_url.rstrip("/")
    if base_url.endswith("/v1/conversation"):
        return base_url
    return f"{base_url}/v1/conversation"


def _require_config() -> None:
    token_id = settings.vnpt_token_id or settings.vnpt_smartbot_token_id
    token_key = settings.vnpt_token_key or settings.vnpt_smartbot_token_key
    has_access_token = bool(
        settings.vnpt_access_token
        or settings.vnpt_smartbot_access_token
        or settings.vnpt_smartbot_api_key
    )
    if (
        not _conversation_url()
        or not token_id
        or not token_key
        or not settings.vnpt_smartbot_bot_id
        or not has_access_token
    ):
        raise EngineError(
            "VNPT SmartBot chưa được cấu hình (thiếu base_url, token_id, token_key, "
            "access_token, hoặc bot_id). Đặt USE_VNPT_SMARTBOT=false để dùng mock.",
            status_code=503,
        )


def _extract_smartbot_object(data: dict[str, Any]) -> dict[str, Any]:
    obj = data.get("object") or {}
    if isinstance(obj, dict) and isinstance(obj.get("sb"), dict):
        return obj["sb"]
    if isinstance(data.get("sb"), dict):
        return data["sb"]
    return {}


def _extract_intent(data: dict[str, Any]) -> str:
    sb = _extract_smartbot_object(data)
    return str(
        sb.get("intent_name")
        or data.get("intent_name")
        or data.get("intent")
        or ""
    ).strip().lower()


def _extract_confidence(data: dict[str, Any]) -> float:
    value = data.get("confidence") or data.get("score") or 0.7
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.7


def classify(message: str, session: Optional[object] = None) -> tuple[str, float]:
    """Classify user intent through VNPT SmartBot, with local fallback if unmapped."""
    _require_config()
    session_id = getattr(session, "session_id", None) or "anonymous"

    try:
        response = httpx.post(
            _conversation_url(),
            headers={
                "Authorization": _auth_value(),
                "Token-id": settings.vnpt_token_id or settings.vnpt_smartbot_token_id,
                "Token-key": settings.vnpt_token_key or settings.vnpt_smartbot_token_key,
                "Content-Type": "application/json",
            },
            json={
                "bot_id": settings.vnpt_smartbot_bot_id,
                "sender_id": session_id,
                "text": message,
                "input_channel": settings.vnpt_smartbot_input_channel,
                "session_id": session_id,
                "metadata": {"button_variables": []},
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = _decode_smartbot_response(response)
        raw_intent = _extract_intent(data)
        mapped = INTENT_MAP.get(raw_intent)
        if mapped:
            return mapped, _extract_confidence(data)
    except EngineError:
        raise
    except Exception:
        pass

    return intent_classifier.classify(message)


def _decode_smartbot_response(response: httpx.Response) -> dict[str, Any]:
    content_type = response.headers.get("content-type", "")
    if "text/event-stream" not in content_type.lower():
        return response.json()

    latest: dict[str, Any] | None = None
    for raw_line in response.text.splitlines():
        line = raw_line.strip()
        if not line.startswith("data:"):
            continue
        payload = line.removeprefix("data:").strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            decoded = httpx.Response(200, content=payload.encode("utf-8")).json()
        except Exception:
            continue
        if isinstance(decoded, dict):
            latest = decoded
    if latest is None:
        raise ValueError("SmartBot stream did not contain JSON data events")
    return latest
