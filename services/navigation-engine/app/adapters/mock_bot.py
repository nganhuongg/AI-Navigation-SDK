"""Mock SmartBot adapter — rule-based intent detection (demo default).

Used when USE_VNPT_SMARTBOT=false. Delegates to the keyword intent classifier.
Signature matches the real adapter: classify(message, session) -> (intent, confidence).
"""

from __future__ import annotations

from typing import Optional

from app.services.assistant import intent_classifier


def classify(message: str, session: Optional[object] = None) -> tuple[str, float]:
    return intent_classifier.classify(message)
