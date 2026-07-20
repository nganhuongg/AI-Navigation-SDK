"""Voice endpoints: /stt (audio → text) and /tts (text → audio)."""

from __future__ import annotations

from time import perf_counter

from fastapi import APIRouter, File, UploadFile

from app.models.common import APIResponse
from app.models.voice import TTSRequest
from app.services.voice import stt_service, tts_service

router = APIRouter(tags=["voice"])


@router.post("/stt")
async def speech_to_text(file: UploadFile = File(...)) -> APIResponse:
    """Transcribe an uploaded audio clip to Vietnamese text."""
    read_started = perf_counter()
    audio_bytes = await file.read()
    request_read_ms = round((perf_counter() - read_started) * 1000)
    result = stt_service.transcribe(audio_bytes)
    result.timing.request_read_ms = request_read_ms
    result.timing.total_ms += request_read_ms
    return APIResponse.ok(result.model_dump())


@router.post("/tts")
def text_to_speech(request: TTSRequest) -> APIResponse:
    """Synthesize speech audio (base64 WAV) from text."""
    return APIResponse.ok(tts_service.synthesize(request.text, request.voice).model_dump())
