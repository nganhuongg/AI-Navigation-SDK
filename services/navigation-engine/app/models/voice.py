"""Voice models: STT (speech→text) and TTS (text→speech)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PreprocessInfo(BaseModel):
    """What the STT-input preprocessing did (Silero VAD / noise suppression)."""

    enabled: bool = True
    vad_applied: bool = False
    denoise_applied: bool = False
    input_sample_rate: int | None = None
    output_sample_rate: int | None = None
    input_duration_ms: int | None = None
    output_duration_ms: int | None = None
    speech_segments: int = 0
    engines: list[str] = Field(default_factory=list)
    note: str = ""


class STTResponse(BaseModel):
    text: str
    confidence: float = 0.0
    preprocess: PreprocessInfo = Field(default_factory=PreprocessInfo)


class TTSRequest(BaseModel):
    text: str
    voice: str = "vi-VN"


class TTSResponse(BaseModel):
    # Audio returned as base64 so it fits the JSON {success,data,error} envelope.
    audio_base64: str
    media_type: str = "audio/wav"
    sample_rate: int = 16000
