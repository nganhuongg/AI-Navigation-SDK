"""Phase 5 tests: STT, TTS, and the safe-passthrough audio preprocessing."""

from __future__ import annotations

import base64
import io
import math
import struct
import wave


def _data(response):
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_stt_returns_transcript(client):
    files = {"file": ("clip.wav", _make_wav(), "audio/wav")}
    data = _data(client.post("/stt", files=files))
    assert isinstance(data["text"], str) and len(data["text"]) > 0
    # preprocess info is always present (even when it is a pass-through).
    assert set(
        [
            "enabled",
            "vad_applied",
            "denoise_applied",
            "input_sample_rate",
            "output_sample_rate",
            "input_duration_ms",
            "output_duration_ms",
            "speech_segments",
            "engines",
            "note",
        ]
    ).issubset(data["preprocess"].keys())
    assert data["preprocess"]["input_sample_rate"] == 16000
    assert data["preprocess"]["enabled"] is False
    assert set(
        [
            "request_read_ms",
            "preprocessing_ms",
            "adapter_ms",
            "total_ms",
        ]
    ).issubset(data["timing"].keys())
    assert data["timing"]["total_ms"] >= 0


def test_tts_returns_valid_wav(client):
    data = _data(client.post("/tts", json={"text": "Bác đến phòng A303 để lấy máu."}))
    assert data["media_type"] == "audio/wav"
    audio = base64.b64decode(data["audio_base64"])
    assert audio[:4] == b"RIFF"  # a valid WAV container


def test_audio_preprocess_passthrough_without_optional_deps():
    from app.services.voice import audio_preprocess

    raw = _make_wav()
    out, info = audio_preprocess.preprocess(raw)
    assert out
    assert info["input_sample_rate"] == 16000
    assert info["output_sample_rate"] == 16000
    assert info["input_duration_ms"] > 0
    if "audio preprocessing dependencies not installed" in info["note"]:
        assert out == raw
        assert info["vad_applied"] is False
    assert set(
        [
            "enabled",
            "vad_applied",
            "denoise_applied",
            "input_sample_rate",
            "output_sample_rate",
            "input_duration_ms",
            "output_duration_ms",
            "speech_segments",
            "engines",
            "note",
        ]
    ).issubset(info.keys())


def test_stt_preprocessing_toggle_enabled(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "use_stt_preprocessing", True)
    files = {"file": ("clip.wav", _make_wav(), "audio/wav")}
    data = _data(client.post("/stt", files=files))

    assert data["preprocess"]["enabled"] is True
    assert data["preprocess"]["input_sample_rate"] == 16000


def _make_wav(sample_rate: int = 16000, duration_seconds: float = 0.25) -> bytes:
    frames = int(sample_rate * duration_seconds)
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        payload = bytearray()
        for i in range(frames):
            value = int(12000 * math.sin(2 * math.pi * 440 * (i / sample_rate)))
            payload.extend(struct.pack("<h", value))
        wav.writeframes(bytes(payload))
    return output.getvalue()
