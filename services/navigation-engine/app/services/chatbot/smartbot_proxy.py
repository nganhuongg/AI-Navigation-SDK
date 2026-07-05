"""Safe backend proxy for VNPT SmartBot conversations."""

from __future__ import annotations

import time
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.models.chatbot import ChatbotMessageRequest, ChatbotMessageResponse
from app.services.assistant import intent_classifier
from app.services.assistant import response_builder, safety_fallback
from app.services.privacy import redactor
from app.services.journey import state_manager
from app.core.errors import NotFoundError

REQUEST_TIMEOUT_SECONDS = 30.0

SYSTEM_PROMPT = (
    "Bạn là trợ lý điều hướng bệnh viện. Bạn chỉ hỗ trợ tìm phòng, hướng dẫn quy trình khám, "
    "giải thích phiếu khám ở mức hành chính và hướng dẫn sử dụng ứng dụng. Bạn không được tư vấn "
    "chẩn đoán, điều trị, thuốc, liều dùng hoặc giải thích kết quả xét nghiệm. Nếu thiếu dữ liệu "
    "hoặc câu hỏi ngoài phạm vi, hãy yêu cầu người dùng gặp nhân viên y tế hoặc chụp lại phiếu khám."
)

ADVANCE_PROMPT = (
    "Trả lời ngắn gọn, rõ ràng, dễ hiểu cho người cao tuổi. Nếu có dữ liệu phòng, tầng hoặc bước "
    "tiếp theo trong metadata, hãy ưu tiên dùng dữ liệu đó. Không tự tạo quy trình khám mới."
)

FALLBACK_REPLY = (
    "Cháu chưa kết nối được trợ lý SmartBot. Bác vui lòng hỏi nhân viên y tế gần nhất "
    "hoặc thử lại sau."
)

logger = get_logger("navigation-engine.chatbot")


def send_message(request: ChatbotMessageRequest) -> ChatbotMessageResponse:
    """Call VNPT SmartBot and normalize its card response for the frontend."""
    if not settings.use_vnpt_smartbot:
        return _local_response(request)

    started = time.perf_counter()
    try:
        _require_config()
        response = httpx.post(
            _conversation_url(),
            headers={
                "Authorization": _auth_value(),
                "Token-id": _token_id(),
                "Token-key": _token_key(),
                "Content-Type": "application/json",
            },
            json=_build_payload(request),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "SmartBot request status=%s latency_ms=%s session_id=%s",
            response.status_code,
            latency_ms,
            request.session_id,
        )
        if response.status_code == 401:
            return ChatbotMessageResponse(
                reply_text="VNPT authentication failed",
                cards=[],
                intent_name=None,
                handoff_required=True,
            )
        response.raise_for_status()
        return _ground_response(_normalize_response(_decode_smartbot_response(response), request), request)
    except httpx.TimeoutException:
        _log_failed_request(started, request.session_id, "timeout")
        return _api_fallback()
    except Exception:
        _log_failed_request(started, request.session_id, "error")
        return _api_fallback()


def _token_id() -> str:
    return settings.vnpt_token_id or settings.vnpt_smartbot_token_id


def _token_key() -> str:
    return settings.vnpt_token_key or settings.vnpt_smartbot_token_key


def _access_token() -> str:
    return (
        settings.vnpt_access_token
        or settings.vnpt_smartbot_access_token
        or settings.vnpt_smartbot_api_key
    )


def _auth_value() -> str:
    token = _access_token()
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
    if not _conversation_url() or not _token_id() or not _token_key() or not _access_token():
        raise RuntimeError("VNPT SmartBot credentials are incomplete")
    if not settings.vnpt_smartbot_bot_id:
        raise RuntimeError("VNPT SmartBot bot_id is missing")


def _build_payload(request: ChatbotMessageRequest) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "bot_id": settings.vnpt_smartbot_bot_id,
        "sender_id": request.sender_id,
        "text": redactor.redact_text(request.text),
        "input_channel": settings.vnpt_smartbot_input_channel,
        "session_id": request.session_id,
        "metadata": {"button_variables": _button_variables(request)},
    }
    if settings.vnpt_smartbot_use_local_prompts:
        payload["settings"] = {
            "system_prompt": SYSTEM_PROMPT,
            "advance_prompt": ADVANCE_PROMPT,
        }
    return payload


def _button_variables(request: ChatbotMessageRequest) -> list[dict[str, str]]:
    values = request.metadata.model_dump()
    return [
        {"variableName": key, "value": "" if value is None else str(value)}
        for key, value in values.items()
    ]


def _normalize_response(data: dict[str, Any], request: ChatbotMessageRequest) -> ChatbotMessageResponse:
    sb = _extract_smartbot_object(data)
    cards = sb.get("card_data")
    if not isinstance(cards, list) or not cards:
        logger.info(
            "SmartBot connected but returned no cards status=%s intent=%s session_id=%s",
            sb.get("card_data_info"),
            sb.get("intent_name"),
            request.session_id,
        )
        return _metadata_fallback(request)
    reply_text = _combine_card_text(cards)
    if not reply_text:
        logger.info(
            "SmartBot connected but returned cards without text intent=%s session_id=%s",
            sb.get("intent_name"),
            request.session_id,
        )
        return _metadata_fallback(request)
    return ChatbotMessageResponse(
        reply_text=reply_text,
        cards=[card for card in cards if isinstance(card, dict)],
        intent_name=_extract_intent(data),
        handoff_required=any(
            isinstance(card, dict) and card.get("type") == "chuyen_gdv"
            for card in cards
        ),
    )


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


def _extract_smartbot_object(data: dict[str, Any]) -> dict[str, Any]:
    obj = data.get("object") or {}
    if isinstance(obj, dict) and isinstance(obj.get("sb"), dict):
        return obj["sb"]
    if isinstance(data.get("sb"), dict):
        return data["sb"]
    return {}


def _extract_intent(data: dict[str, Any]) -> str | None:
    sb = _extract_smartbot_object(data)
    raw = sb.get("intent_name") or data.get("intent_name") or data.get("intent")
    return str(raw).strip() if raw else None


def _combine_card_text(cards: list[Any]) -> str:
    parts: list[str] = []
    for card in cards:
        if not isinstance(card, dict):
            continue
        for key in ("text", "title", "description", "content"):
            value = card.get(key)
            if isinstance(value, str) and value.strip():
                parts.append(value.strip())
        elements = card.get("elements")
        if isinstance(elements, list):
            parts.extend(_combine_card_text(elements).split("\n"))
    return "\n".join(dict.fromkeys(part for part in parts if part))


def _metadata_fallback(request: ChatbotMessageRequest) -> ChatbotMessageResponse:
    if request.metadata.target_room and request.metadata.next_action:
        return ChatbotMessageResponse(
            reply_text=_grounded_metadata_reply(request),
            cards=[],
            intent_name="metadata_fallback",
            handoff_required=False,
        )
    return _local_response(request)


def _local_response(request: ChatbotMessageRequest) -> ChatbotMessageResponse:
    session = _load_session(request.session_id)
    clean_message = redactor.redact_text(request.text)
    intent, confidence = intent_classifier.classify(clean_message)

    refusal = safety_fallback.check(intent)
    if refusal is not None:
        return ChatbotMessageResponse(
            reply_text=refusal,
            cards=[],
            intent_name=intent,
            handoff_required=True,
        )

    reply = response_builder.build(intent, clean_message, session, confidence)
    return ChatbotMessageResponse(
        reply_text=reply.response_text,
        cards=[],
        intent_name=reply.intent,
        handoff_required=reply.is_fallback,
    )


def _api_fallback() -> ChatbotMessageResponse:
    return ChatbotMessageResponse(
        reply_text=FALLBACK_REPLY,
        cards=[],
        intent_name=None,
        handoff_required=True,
    )


def _load_session(session_id: str):
    try:
        return state_manager.get_session(session_id)
    except NotFoundError:
        return None


def _ground_response(response: ChatbotMessageResponse, request: ChatbotMessageRequest) -> ChatbotMessageResponse:
    if response.handoff_required:
        return response
    metadata = request.metadata
    if not metadata.target_room or not metadata.next_action:
        return response
    local_intent, _confidence = intent_classifier.classify(request.text)
    if local_intent not in {"ask_next_step", "ask_route", "ask_current_status"}:
        return response
    if metadata.target_room.lower() in response.reply_text.lower():
        return response
    response.reply_text = _grounded_metadata_reply(request)
    return response


def _grounded_metadata_reply(request: ChatbotMessageRequest) -> str:
    metadata = request.metadata
    floor_text = f" ở tầng {metadata.target_floor}" if metadata.target_floor else ""
    current = f"{metadata.current_step}. " if metadata.current_step else ""
    return (
        f"{current}Bây giờ bác vui lòng đến phòng {metadata.target_room}"
        f"{floor_text} để {metadata.next_action}."
    )


def _log_failed_request(started: float, session_id: str, reason: str) -> None:
    latency_ms = int((time.perf_counter() - started) * 1000)
    logger.info(
        "SmartBot request status=%s latency_ms=%s session_id=%s",
        reason,
        latency_ms,
        session_id,
    )
