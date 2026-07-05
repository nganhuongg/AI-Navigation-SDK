"""OCR endpoint: upload an instruction form image → structured fields.

The ``scenario`` form field only affects the mock adapter (which fixture to serve);
the real SmartReader adapter ignores it and reads the uploaded image.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile

from app.models.common import APIResponse
from app.services.ocr import extraction_service

router = APIRouter(tags=["ocr"])


@router.post("/ocr/extract")
async def extract(
    file: Optional[UploadFile] = File(None),
    scenario: str = Form("clear"),
) -> APIResponse:
    """Extract confirmable fields from an uploaded instruction form."""
    image_bytes = await file.read() if file is not None else None
    filename = file.filename if file is not None else None
    result = extraction_service.extract(image_bytes, filename, scenario)
    return APIResponse.ok(result.model_dump())
