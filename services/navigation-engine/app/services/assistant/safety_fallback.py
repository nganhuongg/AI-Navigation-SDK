"""Safety fallbacks.

The most important rule (vòng-1 §3.2.2): the assistant never gives medical advice.
Fallback wording is pulled from the care journey template's ``fallbacks`` so the
message stays consistent with the rest of the system.
"""

from __future__ import annotations

from typing import Optional

from app.services.journey import template_loader

MEDICAL_FALLBACK_ID = "medical_advice"
DEFAULT_TEMPLATE_ID = "standard_outpatient_v1"

_DEFAULT_MEDICAL_MESSAGE = (
    "Cháu không thể tư vấn điều trị. Bác hỏi trực tiếp bác sĩ hoặc điều dưỡng giúp cháu."
)


def get_fallback_message(fallback_id: str, template_id: str = DEFAULT_TEMPLATE_ID) -> Optional[str]:
    """Look up a fallback message by id from the template (or None)."""
    try:
        template = template_loader.get_template(template_id)
    except Exception:
        return None
    for fallback in template.get("fallbacks", []):
        if fallback.get("fallback_id") == fallback_id:
            return fallback.get("message_vi")
    return None


def medical_refusal() -> str:
    """The safe refusal message for out-of-scope medical questions."""
    return get_fallback_message(MEDICAL_FALLBACK_ID) or _DEFAULT_MEDICAL_MESSAGE


def check(intent: str) -> Optional[str]:
    """Return a refusal message if the intent is unsafe to answer, else None."""
    if intent == "out_of_scope_medical":
        return medical_refusal()
    return None
