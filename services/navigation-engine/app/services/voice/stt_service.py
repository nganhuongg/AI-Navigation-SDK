"""Speech-to-Text service: preprocess audio, then call the SmartVoice adapter."""

from __future__ import annotations

from time import perf_counter
from typing import Optional

from app.adapters import mock_voice, vnpt_smartvoice
from app.core.config import settings
from app.models.voice import PreprocessInfo, STTResponse, STTTimingInfo
from app.services.voice import audio_preprocess


def _get_adapter():
    """Real SmartVoice when enabled, otherwise the mock (demo default)."""
    if settings.use_vnpt_smartvoice_stt or settings.use_vnpt_smartvoice:
        return vnpt_smartvoice
    return mock_voice


def transcribe(audio_bytes: Optional[bytes], scenario: str = "default") -> STTResponse:
    """Run VAD/denoise on the input, then transcribe."""
    total_started = perf_counter()
    preprocess_started = perf_counter()
    if settings.use_stt_preprocessing:
        processed, info = audio_preprocess.preprocess(audio_bytes or b"")
    else:
        processed, info = _preprocessing_disabled(audio_bytes or b"")
    preprocess_ms = round((perf_counter() - preprocess_started) * 1000)

    adapter_started = perf_counter()
    raw = _get_adapter().speech_to_text(processed, scenario)
    adapter_ms = round((perf_counter() - adapter_started) * 1000)
    return STTResponse(
        text=raw.get("text", ""),
        confidence=float(raw.get("confidence", 0.0)),
        preprocess=PreprocessInfo(**info),
        timing=STTTimingInfo(
            preprocessing_ms=preprocess_ms,
            adapter_ms=adapter_ms,
            total_ms=round((perf_counter() - total_started) * 1000),
        ),
    )


def _preprocessing_disabled(audio_bytes: bytes) -> tuple[bytes, dict[str, object]]:
    wav_info = audio_preprocess.read_wav_info(audio_bytes)
    return audio_bytes, {
        "enabled": False,
        "vad_applied": False,
        "denoise_applied": False,
        "input_sample_rate": wav_info.sample_rate if wav_info else None,
        "output_sample_rate": wav_info.sample_rate if wav_info else None,
        "input_duration_ms": wav_info.duration_ms if wav_info else None,
        "output_duration_ms": wav_info.duration_ms if wav_info else None,
        "speech_segments": 0,
        "engines": [],
        "note": "STT preprocessing disabled; input forwarded unchanged",
    }
