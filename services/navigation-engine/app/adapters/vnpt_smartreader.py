"""Real VNPT SmartReader OCR adapter.

SmartReader is a two-step flow:
  1. POST {base_url}/file-service/v1/addFile with multipart field "file".
  2. POST {base_url}{ocr_path} with JSON body containing "file_hash".

The OCR API returns structured document fields. Our current journey parser needs
plain OCR text, so this adapter flattens all extracted text values into one
string and returns that in the same shape as the mock adapter.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import httpx

from app.core.config import settings
from app.core.errors import EngineError

REQUEST_TIMEOUT_SECONDS = 45.0


def _auth_value() -> str:
    token = settings.vnpt_smartreader_access_token or settings.vnpt_smartreader_api_key
    if token.lower().startswith("bearer "):
        return token
    return f"Bearer {token}"


def _require_config() -> None:
    has_access_token = bool(settings.vnpt_smartreader_access_token or settings.vnpt_smartreader_api_key)
    if (
        not settings.vnpt_smartreader_base_url
        or not settings.vnpt_smartreader_token_id
        or not settings.vnpt_smartreader_token_key
        or not has_access_token
    ):
        raise EngineError(
            "VNPT SmartReader chưa được cấu hình (thiếu base_url, token_id, token_key, "
            "hoặc access_token). Đặt USE_VNPT_SMARTREADER=false để dùng mock.",
            status_code=503,
        )


def _headers() -> dict[str, str]:
    return {
        "Authorization": _auth_value(),
        "Token-id": settings.vnpt_smartreader_token_id,
        "Token-key": settings.vnpt_smartreader_token_key,
        "mac-address": settings.vnpt_smartreader_mac_address,
    }


def _url(path: str) -> str:
    base_url = settings.vnpt_smartreader_base_url.strip().rstrip("/")
    if "=" in base_url:
        base_url = base_url.split("=", 1)[1].strip().rstrip("/")
    if base_url and not base_url.startswith(("http://", "https://")):
        base_url = f"https://{base_url}"
    return f"{base_url}/{path.lstrip('/')}"


def _file_type(filename: Optional[str]) -> str:
    suffix = Path(filename or "form.png").suffix.lower().lstrip(".")
    if suffix == "jpg":
        return "jpeg"
    return suffix or "png"


def _upload_file(image_bytes: bytes, filename: Optional[str]) -> dict[str, Any]:
    try:
        response = httpx.post(
            _url("/file-service/v1/addFile"),
            headers=_headers(),
            files={"file": (filename or "form.png", image_bytes)},
            data={"title": filename or "uploaded form", "description": "OCR input"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise EngineError(f"VNPT SmartReader upload failed: {exc}", status_code=502) from exc
    data = response.json()
    obj = data.get("object") or {}
    if not isinstance(obj, dict) or not obj.get("hash"):
        raise EngineError("VNPT SmartReader không trả về file hash.", status_code=502)
    return obj


def _ocr_file(file_hash: str, filename: Optional[str], ocr_path: Optional[str] = None) -> dict[str, Any]:
    try:
        response = httpx.post(
            _url(ocr_path or settings.vnpt_smartreader_ocr_path),
            headers={**_headers(), "Content-Type": "application/json"},
            json={
                "file_hash": file_hash,
                "file_type": _file_type(filename),
                "token": "ai-navigation-sdk",
                "client_session": "ai-navigation-sdk",
                "details": True,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise EngineError(f"VNPT SmartReader OCR failed: {exc}", status_code=502) from exc
    return response.json()


def _field_text(value: Any) -> str:
    if isinstance(value, dict):
        text = value.get("text")
        return str(text) if text is not None else ""
    if isinstance(value, (str, int, float)):
        return str(value)
    return ""


def _collect_texts(value: Any) -> list[str]:
    """Collect OCR text recursively from SmartReader field/list/cell shapes."""
    if isinstance(value, dict):
        texts: list[str] = []
        text = value.get("text")
        if text is not None:
            texts.append(str(text))
        for child_key in ("cells", "items", "rows", "columns", "data"):
            texts.extend(_collect_texts(value.get(child_key)))
        return texts
    if isinstance(value, list):
        texts: list[str] = []
        for item in value:
            texts.extend(_collect_texts(item))
        return texts
    if isinstance(value, (str, int, float)):
        return [str(value)]
    return []


def _cell_text(value: Any) -> str:
    return " ".join(" ".join(str(text).split()) for text in _collect_texts(value) if str(text).strip())


def _collect_table_lines(value: Any) -> list[str]:
    """Collect row-shaped OCR output as tab-separated logical lines.

    SmartReader's table endpoint may return rows/cells. Keeping cells separated
    lets the parser pair "Nội dung chỉ định" and "Ghi chú" with the room in the
    same row instead of mixing text from unrelated columns.
    """
    lines: list[str] = []
    if isinstance(value, dict):
        rows = value.get("rows")
        if isinstance(rows, list):
            for row in rows:
                cells = row.get("cells") if isinstance(row, dict) else None
                if isinstance(cells, list):
                    cell_texts = [_cell_text(cell) for cell in cells]
                    line = "\t".join(text for text in cell_texts if text)
                    if line:
                        lines.append(line)
                elif isinstance(row, list):
                    cell_texts = [_cell_text(cell) for cell in row]
                    line = "\t".join(text for text in cell_texts if text)
                    if line:
                        lines.append(line)
        for child in value.values():
            lines.extend(_collect_table_lines(child))
    elif isinstance(value, list):
        for item in value:
            lines.extend(_collect_table_lines(item))
    return lines


def _extract_text(data: dict[str, Any]) -> str:
    obj = data.get("object") or {}
    if not isinstance(obj, dict):
        return ""
    ignored = {
        "warnings",
        "warning_messages",
        "num_of_pages",
        "total_page_num",
        "genai_usage",
    }
    values: list[str] = []
    seen: set[str] = set()
    for line in _collect_table_lines(obj):
        normalized = line.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            values.append(normalized)
    for key, value in obj.items():
        if key in ignored:
            continue
        for text in _collect_texts(value):
            normalized = text.strip()
            if normalized and normalized not in seen:
                seen.add(normalized)
                values.append(normalized)
    return "\n".join(values)


def _extract_confidence(data: dict[str, Any]) -> float:
    obj = data.get("object") or {}
    if not isinstance(obj, dict):
        return 0.0

    scores: list[float] = []
    stack: list[Any] = list(obj.values())
    while stack:
        value = stack.pop()
        if isinstance(value, dict):
            stack.extend(value.get(child_key) for child_key in ("cells", "items", "rows", "columns", "data"))
            if value.get("confidence_score") is not None:
                try:
                    scores.append(float(value["confidence_score"]))
                except (TypeError, ValueError):
                    pass
        elif isinstance(value, list):
            stack.extend(value)
    if scores:
        return sum(scores) / len(scores)
    return 1.0 if data.get("status") == "OK" or data.get("statusCode") == 200 else 0.0


def read(
    image_bytes: Optional[bytes],
    filename: Optional[str] = None,
    scenario: str = "clear",
    ocr_path: Optional[str] = None,
) -> dict[str, Any]:
    """Upload an image to VNPT SmartReader, OCR it, and return raw text + confidence."""
    _require_config()
    if not image_bytes:
        raise EngineError("Thiếu ảnh phiếu để nhận dạng.", status_code=422)

    uploaded = _upload_file(image_bytes, filename)
    ocr_data = _ocr_file(str(uploaded["hash"]), filename, ocr_path)
    return {
        "source_image": filename or uploaded.get("fileName") or "uploaded",
        "text": _extract_text(ocr_data),
        "confidence": _extract_confidence(ocr_data),
    }
