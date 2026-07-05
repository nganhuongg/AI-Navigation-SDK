"""Shared pytest fixtures.

We add the navigation-engine root to sys.path so ``import app...`` works no matter
which directory pytest is launched from.
"""

from __future__ import annotations

import sys
from pathlib import Path

# app/tests/conftest.py -> parents[2] = navigation-engine root
NAV_ENGINE_ROOT = Path(__file__).resolve().parents[2]
if str(NAV_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(NAV_ENGINE_ROOT))

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


@pytest.fixture(autouse=True)
def force_mock_adapters(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep tests deterministic even when local .env enables real VNPT APIs."""
    monkeypatch.setattr(settings, "use_vnpt_smartreader", False)
    monkeypatch.setattr(settings, "use_vnpt_smartvoice", False)
    monkeypatch.setattr(settings, "use_vnpt_smartvoice_stt", False)
    monkeypatch.setattr(settings, "use_vnpt_smartvoice_tts", False)
    monkeypatch.setattr(settings, "use_vnpt_smartbot", False)
    monkeypatch.setattr(settings, "use_stt_preprocessing", False)
    monkeypatch.setattr(settings, "vnpt_smartbot_use_local_prompts", False)


@pytest.fixture
def client() -> TestClient:
    """A FastAPI test client that calls the app in-process (no network)."""
    return TestClient(app)
