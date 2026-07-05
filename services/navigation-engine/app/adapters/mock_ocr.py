"""Mock OCR adapter — returns a canned raw-OCR payload from a fixture file.

Used when USE_VNPT_SMARTREADER=false (the demo default). It ignores the uploaded
image and returns pre-recorded text so the whole OCR → parse → confirm flow works
with no API key and no network.

Return shape matches what the real adapter returns:
    {"source_image": str, "text": str, "confidence": float}
"""

from __future__ import annotations

from typing import Any, Optional

from app.core.paths import OCR_RESULTS_DIR
from app.storage.json_store import read_json

# Which fixture to serve for a given demo scenario.
FIXTURES = {
    "clear": "ocr_result_001.json",
    "blurry": "ocr_result_blurry_low_confidence.json",
}


def read(
    image_bytes: Optional[bytes] = None,
    filename: Optional[str] = None,
    scenario: str = "clear",
    ocr_path: Optional[str] = None,
) -> dict[str, Any]:
    """Return a canned raw-OCR payload for the requested scenario."""
    fixture_name = FIXTURES.get(scenario, FIXTURES["clear"])
    return read_json(OCR_RESULTS_DIR / fixture_name)
