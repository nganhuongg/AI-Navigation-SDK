"""Application configuration.

All settings are read ONCE from the repository-root ``.env`` file into a typed
``Settings`` object. Every other module imports the shared ``settings`` instance
instead of reading environment variables directly. This keeps configuration in
one place and makes it obvious what the backend can be tuned with.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# The repository root is four directories above this file:
#   repo/services/navigation-engine/app/core/config.py
#   parents[0]=core  parents[1]=app  parents[2]=navigation-engine
#   parents[3]=services  parents[4]=repo root
REPO_ROOT = Path(__file__).resolve().parents[4]
ENV_FILE = REPO_ROOT / ".env"


class Settings(BaseSettings):
    """Typed view of the ``.env`` file. Defaults keep the app runnable with no env."""

    # Server
    engine_host: str = "0.0.0.0"
    engine_port: int = 8001

    # Where the /data directory lives, relative to the navigation-engine folder.
    data_root: str = "../../data"

    # VNPT adapter toggles. False => use the mock adapter (no API key required).
    use_vnpt_smartreader: bool = False
    # Backward-compatible umbrella flag; prefer the per-feature STT/TTS flags below.
    use_vnpt_smartvoice: bool = False
    use_vnpt_smartvoice_stt: bool = False
    use_vnpt_smartvoice_tts: bool = False
    use_vnpt_smartbot: bool = False
    use_stt_preprocessing: bool = False

    # VNPT credentials + endpoints. Blank while running on mock adapters; the user
    # fills these in .env once the backend is ready for real calls.
    vnpt_smartreader_api_key: str = ""
    vnpt_smartvoice_api_key: str = ""
    vnpt_smartbot_api_key: str = ""
    vnpt_smartreader_base_url: str = ""
    vnpt_smartvoice_base_url: str = ""
    vnpt_smartbot_base_url: str = ""
    vnpt_smartvoice_token_id: str = ""
    vnpt_smartvoice_token_key: str = ""
    vnpt_smartvoice_access_token: str = ""
    vnpt_smartvoice_stt_base_url: str = ""
    vnpt_smartvoice_stt_path: str = "/stt-service/v1/grpc/standard"
    vnpt_smartvoice_stt_model: str = "online"
    vnpt_smartvoice_stt_max_alternatives: int = 1
    vnpt_smartvoice_stt_audio_channel_count: int = 1
    vnpt_smartvoice_stt_enable_word_time_offsets: bool = False
    vnpt_smartvoice_stt_enable_automatic_punctuation: bool = False
    vnpt_smartvoice_stt_enable_separate_recognition_per_channel: bool = False
    vnpt_smartvoice_stt_verbatim_transcripts: bool = False
    vnpt_smartvoice_stt_invert_text: int = 1
    vnpt_smartvoice_stt_cap_punct_recovery: int = 1
    vnpt_smartvoice_stt_convert_format: str = ""
    vnpt_smartvoice_stt_token_id: str = ""
    vnpt_smartvoice_stt_token_key: str = ""
    vnpt_smartvoice_stt_access_token: str = ""
    vnpt_smartvoice_stt_api_key: str = ""
    vnpt_smartvoice_tts_base_url: str = ""
    vnpt_smartvoice_tts_path: str = "/tts-service/v2/standard"
    vnpt_smartvoice_tts_token_id: str = ""
    vnpt_smartvoice_tts_token_key: str = ""
    vnpt_smartvoice_tts_access_token: str = ""
    vnpt_smartvoice_tts_api_key: str = ""
    vnpt_smartvoice_tts_model: str = "news"
    vnpt_smartvoice_tts_region: str = "female_north"
    vnpt_smartvoice_tts_audio_format: str = "wav"
    vnpt_smartvoice_tts_sample_rate: int = 22050
    vnpt_smartvoice_tts_use_abbr_converter: bool = True
    vnpt_smartvoice_tts_auto_silence: bool = False
    vnpt_smartvoice_tts_clear_cached: bool = False
    vnpt_smartvoice_tts_domain: str = "general"
    vnpt_smartvoice_tts_speed: float = 1.0
    vnpt_smartvoice_tts_prosody: float = 0.0
    vnpt_smartbot_token_id: str = ""
    vnpt_smartbot_token_key: str = ""
    vnpt_smartbot_access_token: str = ""
    vnpt_smartbot_bot_id: str = ""
    vnpt_smartbot_input_channel: str = "livechat"
    vnpt_smartbot_use_local_prompts: bool = False
    # SmartBot proxy aliases matching the organizer/Postman naming.
    vnpt_access_token: str = ""
    vnpt_token_id: str = ""
    vnpt_token_key: str = ""
    vnpt_smartbot_url: str = "https://assistant-stream.vnpt.vn/v1/conversation"
    vnpt_smartreader_token_id: str = ""
    vnpt_smartreader_token_key: str = ""
    vnpt_smartreader_access_token: str = ""
    vnpt_smartreader_ocr_path: str = "/rpa-service/aidigdoc/v1/ocr/scan-table"
    vnpt_smartreader_mac_address: str = "EGOV-DIGDOC-WEB-API"

    demo_mode: bool = True

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        # The shared .env also holds frontend vars (NEXT_PUBLIC_*); ignore unknowns.
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance so the .env is parsed only once."""
    return Settings()


# Import this everywhere instead of reading os.environ directly.
settings = get_settings()
