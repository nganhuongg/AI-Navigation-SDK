"""Care journey template model.

The template file (``standard_outpatient_v1.json``) is a rich, nested document
(privacy rules, update modes, a blank patient-journey state, a specialized-process
blueprint, and fallbacks). The read endpoints do not need to validate every nested
field, so we keep a light summary model for listing and return the full raw
document for the detail view.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class JourneyTemplateSummary(BaseModel):
    """Small shape returned by GET /journey-templates (the list view)."""

    template_id: str
    version: Optional[int] = None
    template_type: Optional[str] = None
    name: Optional[dict[str, Any]] = None
