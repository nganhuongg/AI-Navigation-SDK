"""VNPT SmartVoice adapter tests for split STT/TTS configuration."""

from __future__ import annotations


def test_smartvoice_stt_uses_stt_specific_config(monkeypatch):
    from app.adapters import vnpt_smartvoice
    from app.core.config import settings

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "message": "IDG-00000000",
                "object": {
                    "results": [
                        {
                            "alternatives": [
                                {
                                    "transcript": "toi can di dau",
                                    "confidence": -3.5,
                                }
                            ],
                            "channelTag": 1.0,
                        }
                    ],
                    "audio_duration": 4.8,
                    "status": "OK",
                },
            }

    def fake_post(url, headers, **kwargs):
        assert url == "https://stt.example/stt-service/v1/grpc/standard"
        assert headers["Token-id"] == "stt-id"
        assert headers["Token-key"] == "stt-key"
        assert headers["Authorization"] == "Bearer stt-token"
        assert "audioFile" in kwargs["files"]
        assert len(kwargs["data"]["clientSession"]) > 0
        assert kwargs["data"]["maxAlternatives"] == "1"
        assert kwargs["data"]["audioChannelCount"] == "1"
        assert kwargs["data"]["enableWordTimeOffsets"] == "false"
        assert kwargs["data"]["enableAutomaticPunctuation"] == "false"
        assert kwargs["data"]["enableSeparateRecognitionPerChannel"] == "false"
        assert kwargs["data"]["model"] == "offline"
        assert kwargs["data"]["verbatimTranscripts"] == "false"
        assert kwargs["data"]["customConfiguration[invert_text]"] == "1"
        assert kwargs["data"]["customConfiguration[cap_punct_recovery]"] == "1"
        return FakeResponse()

    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_base_url", "https://stt.example")
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_path", "/stt-service/v1/grpc/standard")
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_model", "offline")
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_max_alternatives", 1)
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_audio_channel_count", 1)
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_enable_word_time_offsets", False)
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_enable_automatic_punctuation", False)
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_enable_separate_recognition_per_channel", False)
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_verbatim_transcripts", False)
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_invert_text", 1)
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_cap_punct_recovery", 1)
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_convert_format", "")
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_token_id", "stt-id")
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_token_key", "stt-key")
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_access_token", "stt-token")
    monkeypatch.setattr(vnpt_smartvoice.httpx, "post", fake_post)

    result = vnpt_smartvoice.speech_to_text(b"RIFFaudio")

    assert result == {"text": "toi can di dau", "confidence": -3.5}


def test_smartvoice_stt_http_error_becomes_engine_error(monkeypatch):
    import httpx

    from app.adapters import vnpt_smartvoice
    from app.core.config import settings
    from app.core.errors import EngineError

    def fake_post(url, headers, **kwargs):
        request = httpx.Request("POST", url)
        response = httpx.Response(500, request=request)
        raise httpx.HTTPStatusError("server error", request=request, response=response)

    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_base_url", "https://stt.example")
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_path", "/stt-service/v1/grpc/standard")
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_token_id", "stt-id")
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_token_key", "stt-key")
    monkeypatch.setattr(settings, "vnpt_smartvoice_stt_access_token", "stt-token")
    monkeypatch.setattr(vnpt_smartvoice.httpx, "post", fake_post)

    try:
        vnpt_smartvoice.speech_to_text(b"RIFFaudio")
    except EngineError as exc:
        assert exc.status_code == 502
        assert "VNPT SmartVoice STT lỗi HTTP 500" in exc.message
    else:
        raise AssertionError("Expected EngineError")


def test_smartvoice_tts_uses_tts_specific_config(monkeypatch):
    from app.adapters import vnpt_smartvoice
    from app.core.config import settings

    class FakePostResponse:
        headers = {"Content-Type": "application/json"}

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "message": "IDG-00000000",
                "object": {
                    "code": "success",
                    "playlist": [
                        {
                            "idx": "0",
                            "text": "Xin chao",
                            "text_len": 8,
                            "total": 1,
                            "audio_link": "https://cdn.example/tts.wav",
                        }
                    ],
                    "text_id": "abc",
                    "version": "1.0.0",
                },
            }

    class FakeAudioResponse:
        content = b"RIFFtts"
        headers = {"Content-Type": "audio/wav"}

        def raise_for_status(self):
            return None

    def fake_post(url, headers, **kwargs):
        assert url == "https://tts.example/tts-service/v2/standard"
        assert headers["Token-id"] == "tts-id"
        assert headers["Token-key"] == "tts-key"
        assert headers["Authorization"] == "Bearer tts-token"
        assert headers["Content-Type"] == "application/json"
        assert kwargs["json"] == {
            "text": "Xin chao",
            "model": "news",
            "region": "female_north",
            "audio_format": "wav",
            "sample_rate": 22050,
            "use_abbr_converter": True,
            "auto_silence": False,
            "clear_cached": False,
            "domain": "general",
            "speed": 1.0,
            "prosody": 0.0,
        }
        return FakePostResponse()

    def fake_get(url, **kwargs):
        assert url == "https://cdn.example/tts.wav"
        return FakeAudioResponse()

    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_base_url", "https://tts.example")
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_path", "/tts-service/v2/standard")
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_token_id", "tts-id")
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_token_key", "tts-key")
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_access_token", "tts-token")
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_model", "news")
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_region", "female_north")
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_audio_format", "wav")
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_sample_rate", 22050)
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_use_abbr_converter", True)
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_auto_silence", False)
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_clear_cached", False)
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_domain", "general")
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_speed", 1.0)
    monkeypatch.setattr(settings, "vnpt_smartvoice_tts_prosody", 0.0)
    monkeypatch.setattr(vnpt_smartvoice.httpx, "post", fake_post)
    monkeypatch.setattr(vnpt_smartvoice.httpx, "get", fake_get)

    result = vnpt_smartvoice.text_to_speech("Xin chao")

    assert result == {"audio_bytes": b"RIFFtts", "media_type": "audio/wav", "sample_rate": 22050}
