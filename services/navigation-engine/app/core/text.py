"""Vietnamese text normalization shared by the matcher and intent classifier."""

from __future__ import annotations

import unicodedata


def normalize_vi(text: str) -> str:
    """Lowercase, map đ→d, and strip diacritics for loose, accent-insensitive matching.

    "Lấy máu" -> "lay mau". This lets us compare what a patient types/says against
    room names and aliases without worrying about accents or casing.
    """
    text = text.lower().strip().replace("đ", "d")
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
