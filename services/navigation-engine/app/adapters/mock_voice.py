"""Mock SmartVoice adapter — canned STT transcript + a silent WAV for TTS.

Used when the relevant SmartVoice STT/TTS flag is false (the demo default). No
API key or network needed. Same two-method shape as the real adapter.
"""

from __future__ import annotations

import io
import wave
from typing import Any, Optional

# A canned Vietnamese question so the demo STT flow always produces something real.
DEMO_TRANSCRIPT = "Tôi vừa khám xong thì đi đâu?"

SAMPLE_RATE = 16000
SILENCE_SECONDS = 0.5


def speech_to_text(audio_bytes: Optional[bytes], scenario: str = "default") -> dict[str, Any]:
    """Return a canned transcript (ignores the uploaded audio)."""
    return {"text": DEMO_TRANSCRIPT, "confidence": 0.95}


def text_to_speech(text: str, voice: str = "vi-VN") -> dict[str, Any]:
    """Return a short silent 16 kHz mono WAV so the endpoint yields playable audio."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(b"\x00\x00" * int(SAMPLE_RATE * SILENCE_SECONDS))
    return {"audio_bytes": buffer.getvalue(), "media_type": "audio/wav", "sample_rate": SAMPLE_RATE}
