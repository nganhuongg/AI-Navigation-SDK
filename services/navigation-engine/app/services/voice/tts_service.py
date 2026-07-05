"""Text-to-Speech service: call the SmartVoice adapter, return base64 audio."""

from __future__ import annotations

import base64

from app.adapters import mock_voice, vnpt_smartvoice
from app.core.config import settings
from app.models.voice import TTSResponse


def _get_adapter():
    if settings.use_vnpt_smartvoice_tts or settings.use_vnpt_smartvoice:
        return vnpt_smartvoice
    return mock_voice


def synthesize(text: str, voice: str = "vi-VN") -> TTSResponse:
    """Turn text into speech audio (base64-encoded for the JSON envelope)."""
    raw = _get_adapter().text_to_speech(text, voice)
    return TTSResponse(
        audio_base64=base64.b64encode(raw["audio_bytes"]).decode("ascii"),
        media_type=raw.get("media_type", "audio/wav"),
        sample_rate=int(raw.get("sample_rate", 16000)),
    )
