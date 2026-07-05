"""Health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings
from app.models.common import APIResponse

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> APIResponse:
    """Liveness probe. Also reports which VNPT services are on the real adapter
    (vs. mock) so admin UIs can show accurate "Real"/"Mock" status without
    duplicating the .env flags."""
    return APIResponse.ok(
        {
            "status": "ok",
            "service": "navigation-engine",
            "services": {
                "ocr": {"real": settings.use_vnpt_smartreader},
                "smartvoice_stt": {"real": settings.use_vnpt_smartvoice_stt},
                "smartvoice_tts": {"real": settings.use_vnpt_smartvoice_tts},
                "smartbot": {"real": settings.use_vnpt_smartbot},
            },
        }
    )
