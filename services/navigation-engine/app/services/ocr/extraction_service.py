"""OCR extraction service: pick an adapter, read the form, parse the fields.

    image -> adapter.read() -> raw text + confidence -> schema_parser -> OCRResult
"""

from __future__ import annotations

import uuid
from typing import Optional

from app.adapters import mock_ocr, vnpt_smartreader
from app.core.config import settings
from app.models.ocr import OCRFields, OCRResult
from app.models.session import SpecializedProcess
from app.services.journey import template_loader
from app.services.ocr import schema_parser
from app.services.privacy import redactor

# Below this confidence we flag the result so the UI can show the retry fallback.
OCR_CONFIDENCE_THRESHOLD = 0.6

DEFAULT_TEMPLATE_ID = "standard_outpatient_v1"
SCAN_TABLE_PATH = "/rpa-service/aidigdoc/v1/ocr/scan-table"


def _get_adapter():
    """Real SmartReader when enabled, otherwise the mock (demo default)."""
    if settings.use_vnpt_smartreader:
        return vnpt_smartreader
    return mock_ocr


def extract(
    image_bytes: Optional[bytes],
    filename: Optional[str] = None,
    scenario: str = "clear",
    template_id: str = DEFAULT_TEMPLATE_ID,
) -> OCRResult:
    """Read an instruction form image and return structured, confirmable fields."""
    raw = _get_adapter().read(image_bytes, filename, scenario, SCAN_TABLE_PATH)

    # The parser needs the journey blueprint to map room codes -> service ids.
    template = template_loader.get_template(template_id)
    blueprint = SpecializedProcess(**template["specialized_process_blueprint"])

    clean_text = redactor.redact_text(raw.get("text", ""))
    parsed = schema_parser.parse_fields(clean_text, blueprint)
    confidence = float(raw.get("confidence", 0.0))

    return OCRResult(
        ocr_result_id="ocr_" + uuid.uuid4().hex[:12],
        source_image=raw.get("source_image", "uploaded"),
        confidence=confidence,
        fields=OCRFields(**parsed),
        requires_user_confirmation=True,
        is_low_confidence=confidence < OCR_CONFIDENCE_THRESHOLD,
    )
