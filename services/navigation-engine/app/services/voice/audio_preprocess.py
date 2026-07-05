"""STT-input audio preprocessing: denoise + Silero VAD + 16 kHz mono WAV.

This module is used only before Speech-to-Text. TTS output is never processed.

The hard dependencies stay optional because the demo must run on mock adapters
without downloading PyTorch. When optional packages are present, the pipeline is:

1. Decode audio.
2. Mix to mono and resample to 16 kHz.
3. Apply RNNoise when available, otherwise noisereduce when available.
4. Run Silero VAD and keep speech segments only.
5. Return 16-bit PCM WAV bytes for SmartVoice STT.
"""

from __future__ import annotations

import io
import wave
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

TARGET_SAMPLE_RATE = 16000
TARGET_CHANNELS = 1
TARGET_SAMPLE_WIDTH = 2


@dataclass
class WavInfo:
    sample_rate: int
    channels: int
    sample_width: int
    frames: int

    @property
    def duration_ms(self) -> int:
        if self.sample_rate <= 0:
            return 0
        return round((self.frames / self.sample_rate) * 1000)


def preprocess(audio_bytes: bytes, sample_rate: int = TARGET_SAMPLE_RATE) -> tuple[bytes, dict[str, Any]]:
    """Return ``(processed_audio_bytes, info_dict)`` and never raise.

    If optional audio ML dependencies are missing or the uploaded audio cannot be
    decoded by them, the function returns the original bytes with explanatory
    metadata. Valid PCM WAV input still gets basic metadata through stdlib.
    """

    info: dict[str, Any] = {
        "enabled": True,
        "vad_applied": False,
        "denoise_applied": False,
        "input_sample_rate": None,
        "output_sample_rate": None,
        "input_duration_ms": None,
        "output_duration_ms": None,
        "speech_segments": 0,
        "engines": [],
        "note": "",
    }
    if not audio_bytes:
        info["note"] = "empty audio"
        return audio_bytes, info

    wav_info = _read_wav_info(audio_bytes)
    if wav_info:
        info["input_sample_rate"] = wav_info.sample_rate
        info["input_duration_ms"] = wav_info.duration_ms

    try:
        import numpy as np
        import soundfile as sf
    except Exception:
        info["note"] = "audio preprocessing dependencies not installed; input forwarded unchanged"
        if wav_info:
            info["output_sample_rate"] = wav_info.sample_rate
            info["output_duration_ms"] = wav_info.duration_ms
        return audio_bytes, info

    try:
        data, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
        data = np.asarray(data, dtype=np.float32)
        if data.size == 0:
            info["note"] = "decoded audio was empty"
            return audio_bytes, info

        if data.ndim > 1:
            data = data.mean(axis=1)

        info["input_sample_rate"] = int(sr)
        info["input_duration_ms"] = _duration_ms(len(data), sr)

        data = _resample_if_needed(data, sr, sample_rate)
        sr = sample_rate
        data = _normalize_peak(data)

        data, denoise_engine = _denoise(data, sr)
        if denoise_engine:
            info["denoise_applied"] = True
            info["engines"].append(denoise_engine)

        data, vad_segments = _apply_silero_vad(data, sr)
        if vad_segments > 0:
            info["vad_applied"] = True
            info["speech_segments"] = vad_segments
            info["engines"].append("silero-vad")

        data = _normalize_peak(data)
        out = io.BytesIO()
        sf.write(out, data, sr, format="WAV", subtype="PCM_16")
        processed = out.getvalue()
        processed_info = _read_wav_info(processed)
        info["output_sample_rate"] = sr
        info["output_duration_ms"] = processed_info.duration_ms if processed_info else _duration_ms(len(data), sr)
        if not info["engines"]:
            info["note"] = "decoded and normalized; optional denoise/VAD engines not installed"
        return processed, info
    except Exception as exc:
        info["note"] = f"preprocessing skipped: {exc}"
        if wav_info:
            info["output_sample_rate"] = wav_info.sample_rate
            info["output_duration_ms"] = wav_info.duration_ms
        return audio_bytes, info


def _read_wav_info(audio_bytes: bytes) -> WavInfo | None:
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wav:
            return WavInfo(
                sample_rate=wav.getframerate(),
                channels=wav.getnchannels(),
                sample_width=wav.getsampwidth(),
                frames=wav.getnframes(),
            )
    except Exception:
        return None


def read_wav_info(audio_bytes: bytes) -> WavInfo | None:
    return _read_wav_info(audio_bytes)


def _duration_ms(frame_count: int, sample_rate: int) -> int:
    if sample_rate <= 0:
        return 0
    return round((frame_count / sample_rate) * 1000)


def _normalize_peak(data: Any) -> Any:
    import numpy as np

    peak = float(np.max(np.abs(data))) if data.size else 0.0
    if peak <= 0:
        return data
    if peak > 1.0:
        return data / peak
    return data


def _resample_if_needed(data: Any, source_rate: int, target_rate: int) -> Any:
    if int(source_rate) == int(target_rate):
        return data

    try:
        from scipy.signal import resample_poly

        from math import gcd

        divisor = gcd(int(source_rate), int(target_rate))
        up = int(target_rate) // divisor
        down = int(source_rate) // divisor
        return resample_poly(data, up, down).astype("float32")
    except Exception:
        import numpy as np

        source_len = len(data)
        target_len = max(1, round(source_len * (target_rate / source_rate)))
        source_x = np.linspace(0.0, 1.0, num=source_len, endpoint=False)
        target_x = np.linspace(0.0, 1.0, num=target_len, endpoint=False)
        return np.interp(target_x, source_x, data).astype("float32")


def _denoise(data: Any, sample_rate: int) -> tuple[Any, str | None]:
    rnnoise_result = _try_rnnoise(data, sample_rate)
    if rnnoise_result is not None:
        return rnnoise_result, "rnnoise"

    try:
        import noisereduce as nr

        return nr.reduce_noise(y=data, sr=sample_rate), "noisereduce"
    except Exception:
        return data, None


def _try_rnnoise(data: Any, sample_rate: int) -> Any | None:
    """Try common Python RNNoise wrappers without making one mandatory."""

    try:
        from rnnoise import RNNoise

        denoiser = RNNoise(sample_rate=sample_rate)
        return denoiser.process(data)
    except Exception:
        pass

    try:
        from pyrnnoise import RNNoise

        denoiser = RNNoise(sample_rate)
        return denoiser.process_frame(data)
    except Exception:
        return None


def _apply_silero_vad(data: Any, sample_rate: int) -> tuple[Any, int]:
    try:
        import numpy as np
        import torch
        from silero_vad import get_speech_timestamps

        tensor = torch.from_numpy(np.asarray(data, dtype=np.float32))
        model = _silero_model()
        timestamps = get_speech_timestamps(tensor, model, sampling_rate=sample_rate)
        if not timestamps:
            return data, 0

        segments = [data[item["start"] : item["end"]] for item in timestamps if item["end"] > item["start"]]
        if not segments:
            return data, 0
        return np.concatenate(segments).astype("float32"), len(segments)
    except Exception:
        return data, 0


@lru_cache(maxsize=1)
def _silero_model() -> Any:
    from silero_vad import load_silero_vad

    return load_silero_vad()
