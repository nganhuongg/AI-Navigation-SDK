"""Real VNPT SmartVoice adapter - Speech-to-Text and Text-to-Speech.

STT and TTS can be enabled independently:
  USE_VNPT_SMARTVOICE_STT=true
  USE_VNPT_SMARTVOICE_TTS=true

STT is wired to the VNPT Postman collection shape:
  POST {base_url}{stt_path}
  headers: token-id, token-key, Authorization
  multipart: audioFile, clientSession

TTS uses VNPT /tts-service/v2/standard: submit text, read JSON audio_link, download audio.
"""

from __future__ import annotations

from uuid import uuid4
from typing import Any, Optional

import httpx

from app.core.config import settings
from app.core.errors import EngineError

REQUEST_TIMEOUT_SECONDS = 30.0
VNPT_TTS_REGIONS = {
    "female_north_ngochoa",
    "female_north",
    "female_central",
    "female_south",
    "male_north",
    "male_central",
    "male_south",
}


def _with_bearer(token: str) -> str:
    """Return Authorization header value, accepting either raw token or Bearer token."""
    if token.lower().startswith("bearer "):
        return token
    return f"Bearer {token}"


def _url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _stt_config() -> dict[str, str]:
    return {
        "base_url": settings.vnpt_smartvoice_stt_base_url or settings.vnpt_smartvoice_base_url,
        "path": settings.vnpt_smartvoice_stt_path,
        "model": settings.vnpt_smartvoice_stt_model,
        "max_alternatives": str(settings.vnpt_smartvoice_stt_max_alternatives),
        "audio_channel_count": str(settings.vnpt_smartvoice_stt_audio_channel_count),
        "enable_word_time_offsets": str(settings.vnpt_smartvoice_stt_enable_word_time_offsets).lower(),
        "enable_automatic_punctuation": str(settings.vnpt_smartvoice_stt_enable_automatic_punctuation).lower(),
        "enable_separate_recognition_per_channel": str(
            settings.vnpt_smartvoice_stt_enable_separate_recognition_per_channel
        ).lower(),
        "verbatim_transcripts": str(settings.vnpt_smartvoice_stt_verbatim_transcripts).lower(),
        "invert_text": str(settings.vnpt_smartvoice_stt_invert_text),
        "cap_punct_recovery": str(settings.vnpt_smartvoice_stt_cap_punct_recovery),
        "convert_format": settings.vnpt_smartvoice_stt_convert_format,
        "token_id": settings.vnpt_smartvoice_stt_token_id or settings.vnpt_smartvoice_token_id,
        "token_key": settings.vnpt_smartvoice_stt_token_key or settings.vnpt_smartvoice_token_key,
        "access_token": (
            settings.vnpt_smartvoice_stt_access_token
            or settings.vnpt_smartvoice_stt_api_key
            or settings.vnpt_smartvoice_access_token
            or settings.vnpt_smartvoice_api_key
        ),
    }


def _tts_config() -> dict[str, str]:
    return {
        "base_url": settings.vnpt_smartvoice_tts_base_url or settings.vnpt_smartvoice_base_url,
        "path": settings.vnpt_smartvoice_tts_path,
        "token_id": settings.vnpt_smartvoice_tts_token_id or settings.vnpt_smartvoice_token_id,
        "token_key": settings.vnpt_smartvoice_tts_token_key or settings.vnpt_smartvoice_token_key,
        "access_token": (
            settings.vnpt_smartvoice_tts_access_token
            or settings.vnpt_smartvoice_tts_api_key
            or settings.vnpt_smartvoice_access_token
            or settings.vnpt_smartvoice_api_key
        ),
    }


def _require_config(config: dict[str, str], feature: str) -> None:
    if not config["base_url"] or not config["token_id"] or not config["token_key"] or not config["access_token"]:
        raise EngineError(
            f"VNPT SmartVoice {feature} chưa được cấu hình (thiếu base_url, token_id, "
            f"token_key, hoặc access_token). Đặt USE_VNPT_SMARTVOICE_{feature}=false để dùng mock.",
            status_code=503,
        )


def _headers(config: dict[str, str]) -> dict[str, str]:
    return {
        "Token-id": config["token_id"],
        "Token-key": config["token_key"],
        "Authorization": _with_bearer(config["access_token"]),
    }


def _tts_region(voice: str) -> str:
    """Map the public voice field to a VNPT region, preserving old vi-VN clients."""
    return voice if voice in VNPT_TTS_REGIONS else settings.vnpt_smartvoice_tts_region


def _tts_media_type(audio_format: str) -> str:
    return "audio/mpeg" if audio_format.lower() == "mp3" else "audio/wav"


def _extract_tts_audio_link(data: dict[str, Any]) -> str:
    obj = data.get("object") or data
    code = obj.get("code")
    if code and code != "success":
        status_code = 202 if code == "pending" else 502
        raise EngineError(f"VNPT SmartVoice TTS chưa trả về audio thành công: {code}.", status_code=status_code)

    if obj.get("r_audio_full_finished") and obj.get("r_audio_full"):
        return str(obj["r_audio_full"])

    playlist = obj.get("playlist") or []
    if playlist and playlist[0].get("audio_link"):
        return str(playlist[0]["audio_link"])

    raise EngineError("VNPT SmartVoice TTS không trả về audio_link.", status_code=502)


def _extract_stt_text(data: dict[str, Any]) -> str:
    """Extract transcript from known VNPT STT response variants."""

    direct = data.get("text") or data.get("result") or data.get("transcript")
    if direct:
        return str(direct)

    hypotheses = data.get("hypotheses") or []
    if hypotheses and hypotheses[0].get("transcript"):
        return str(hypotheses[0]["transcript"])

    obj = data.get("object") or {}
    results = obj.get("results") or data.get("results") or []
    for result in results:
        alternatives = result.get("alternatives") or []
        for alternative in alternatives:
            transcript = alternative.get("transcript") or alternative.get("text")
            if transcript:
                return str(transcript)

    return ""


def _extract_stt_confidence(data: dict[str, Any]) -> float:
    direct = data.get("confidence") or data.get("score")
    if direct is not None:
        return float(direct)

    obj = data.get("object") or {}
    results = obj.get("results") or data.get("results") or []
    for result in results:
        alternatives = result.get("alternatives") or []
        for alternative in alternatives:
            confidence = alternative.get("confidence") or alternative.get("score")
            if confidence is not None:
                return float(confidence)

    return 0.0


def speech_to_text(audio_bytes: Optional[bytes], scenario: str = "default") -> dict[str, Any]:
    """Call VNPT synchronous STT and return transcript + confidence."""
    config = _stt_config()
    _require_config(config, "STT")
    if not audio_bytes:
        raise EngineError("Thiếu dữ liệu âm thanh để nhận dạng.", status_code=422)

    try:
        response = httpx.post(
            _url(config["base_url"], config["path"]),
            headers=_headers(config),
            files={"audioFile": ("audio.wav", audio_bytes, "audio/wav")},
            data={
                "clientSession": str(uuid4()),
                "maxAlternatives": config["max_alternatives"],
                "audioChannelCount": config["audio_channel_count"],
                "enableWordTimeOffsets": config["enable_word_time_offsets"],
                "enableAutomaticPunctuation": config["enable_automatic_punctuation"],
                "enableSeparateRecognitionPerChannel": config["enable_separate_recognition_per_channel"],
                "model": config["model"],
                "verbatimTranscripts": config["verbatim_transcripts"],
                "customConfiguration[invert_text]": config["invert_text"],
                "customConfiguration[cap_punct_recovery]": config["cap_punct_recovery"],
                "customConfiguration[convert_format]": config["convert_format"],
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        raise EngineError(
            f"VNPT SmartVoice STT lỗi HTTP {status}. Kiểm tra audio WAV và token STT.",
            status_code=502,
        ) from exc
    except httpx.RequestError as exc:
        raise EngineError(f"Không kết nối được VNPT SmartVoice STT: {exc}", status_code=503) from exc
    except ValueError as exc:
        raise EngineError("VNPT SmartVoice STT trả về response không phải JSON.", status_code=502) from exc
    return {"text": _extract_stt_text(data), "confidence": _extract_stt_confidence(data)}


def text_to_speech(text: str, voice: str = "vi-VN") -> dict[str, Any]:
    """Call VNPT TTS v2 standard and return downloaded audio bytes."""
    config = _tts_config()
    _require_config(config, "TTS")
    normalized_text = text.strip()
    if not normalized_text:
        raise EngineError("Thiếu nội dung để chuyển thành giọng nói.", status_code=422)
    if len(normalized_text) > 2000:
        raise EngineError("VNPT SmartVoice TTS v2 chỉ hỗ trợ tối đa 2000 ký tự.", status_code=422)

    audio_format = settings.vnpt_smartvoice_tts_audio_format
    payload = {
        "text": normalized_text,
        "model": settings.vnpt_smartvoice_tts_model,
        "region": _tts_region(voice),
        "audio_format": audio_format,
        "sample_rate": settings.vnpt_smartvoice_tts_sample_rate,
        "use_abbr_converter": settings.vnpt_smartvoice_tts_use_abbr_converter,
        "auto_silence": settings.vnpt_smartvoice_tts_auto_silence,
        "clear_cached": settings.vnpt_smartvoice_tts_clear_cached,
        "domain": settings.vnpt_smartvoice_tts_domain,
        "speed": settings.vnpt_smartvoice_tts_speed,
        "prosody": settings.vnpt_smartvoice_tts_prosody,
    }
    response = httpx.post(
        _url(config["base_url"], config["path"]),
        headers={**_headers(config), "Content-Type": "application/json"},
        json=payload,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    try:
        audio_link = _extract_tts_audio_link(response.json())
    except ValueError:
        return {
            "audio_bytes": response.content,
            "media_type": response.headers.get("Content-Type", _tts_media_type(audio_format)),
            "sample_rate": settings.vnpt_smartvoice_tts_sample_rate,
        }

    audio_response = httpx.get(audio_link, timeout=REQUEST_TIMEOUT_SECONDS)
    audio_response.raise_for_status()
    return {
        "audio_bytes": audio_response.content,
        "media_type": audio_response.headers.get("Content-Type", _tts_media_type(audio_format)),
        "sample_rate": settings.vnpt_smartvoice_tts_sample_rate,
    }
