"""OCR result models (mirror shared-types/ocr.ts).

The ``fields`` here are exactly what a confirmed instruction form contributes to a
session, so they line up 1:1 with ConfirmOcrFields used by /session/confirm-ocr.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class OCRFields(BaseModel):
    initial_exam_room: Optional[str] = None
    ordered_services: list[str] = Field(default_factory=list)
    return_room: Optional[str] = None
    detected_room_codes: list[str] = Field(default_factory=list)
    room_descriptions: dict[str, str] = Field(default_factory=dict)
    room_notes: dict[str, str] = Field(default_factory=dict)
    room_queue_numbers: dict[str, str] = Field(default_factory=dict)


class OCRResult(BaseModel):
    ocr_result_id: str
    source_image: str
    confidence: float
    fields: OCRFields
    # The patient should always confirm the extracted fields before we use them.
    requires_user_confirmation: bool = True
    # True when confidence is below threshold → the UI shows the "chụp lại" fallback.
    is_low_confidence: bool = False
