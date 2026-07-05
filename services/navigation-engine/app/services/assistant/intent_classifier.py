"""Rule-based intent classifier (MVP).

Matches accent-insensitive keyword phrases. Order matters: medical questions are
checked first for safety, then next-step, route, and status.

This is what the mock SmartBot uses, and it is also the fallback the real SmartBot
adapter falls back to when the API is unsure or unavailable.
"""

from __future__ import annotations

from app.core.text import normalize_vi

# Treatment-seeking phrases → we must refuse (not "where is the pharmacy").
MEDICAL_PHRASES = [
    "uong thuoc", "uong gi", "thuoc gi", "dieu tri", "chua benh", "lieu dung",
    "lieu luong", "trieu chung", "benh gi", "co nen uong", "uong loai nao",
    "dung thuoc gi", "co sao khong", "nguy hiem khong",
]
NEXT_STEP_PHRASES = [
    "tiep theo", "buoc tiep", "tiep tuc", "kham xong", "vua kham", "sau khi kham",
    "gio di dau", "gio lam gi", "lam gi tiep", "di dau tiep", "buoc ke tiep",
    "xong roi thi",
]
ROUTE_PHRASES = [
    "o dau", "cho nao", "phong nao", "chi duong", "duong den", "den phong",
    "di den", "lam sao den", "huong nao", "toi muon den", "toi can den",
    "tim phong", "cho toi den",
]
STATUS_PHRASES = [
    "dang o buoc", "tinh trang", "so thu tu", "con may buoc", "bao lau nua",
    "buoc hien tai", "toi dang o dau", "con bao lau",
]


def _hit(text: str, phrases: list[str]) -> bool:
    return any(phrase in text for phrase in phrases)


def classify(message: str) -> tuple[str, float]:
    """Return (intent, confidence) for a user message."""
    text = normalize_vi(message)
    if _hit(text, MEDICAL_PHRASES):
        return "out_of_scope_medical", 0.9
    if _hit(text, NEXT_STEP_PHRASES):
        return "ask_next_step", 0.8
    if _hit(text, ROUTE_PHRASES):
        return "ask_route", 0.8
    if _hit(text, STATUS_PHRASES):
        return "ask_current_status", 0.75
    return "unknown", 0.3
