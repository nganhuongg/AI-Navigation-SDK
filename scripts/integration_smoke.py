"""In-process integration smoke tests for the AI Navigation SDK backend."""

from __future__ import annotations

import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
ENGINE_ROOT = REPO_ROOT / "services" / "navigation-engine"
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


def require_ok(response, label: str) -> dict:
    if response.status_code != 200:
        raise RuntimeError(f"{label} failed: HTTP {response.status_code} {response.text}")
    body = response.json()
    if not body.get("success"):
        raise RuntimeError(f"{label} failed: {body}")
    return body["data"]


def main() -> int:
    settings.use_vnpt_smartreader = False
    settings.use_vnpt_smartvoice = False
    settings.use_vnpt_smartvoice_stt = False
    settings.use_vnpt_smartvoice_tts = False
    settings.use_vnpt_smartbot = False
    settings.use_stt_preprocessing = False

    client = TestClient(app)

    health = require_ok(client.get("/health"), "health")
    if health.get("status") != "ok":
        raise RuntimeError(f"Unexpected health payload: {health}")

    session = require_ok(
        client.post("/session/start", json={"template_id": "standard_outpatient_v1"}),
        "session start",
    )
    session_id = session["session_id"]

    ocr = require_ok(
        client.post("/ocr/extract", data={"scenario": "clear"}),
        "mock OCR extraction",
    )
    fields = dict(ocr["fields"])
    fields["completed_steps"] = ["register", "identity", "payment"]

    confirmed = require_ok(
        client.post(
            f"/session/{session_id}/confirm-ocr",
            json={"fields": fields, "confidence": ocr["confidence"]},
        ),
        "confirm OCR",
    )
    target_room = confirmed["next_action"].get("target_room")
    if not target_room:
        raise RuntimeError(f"Expected route target after OCR confirmation: {confirmed}")

    route = require_ok(
        client.post(
            "/route",
            json={
                "session_id": session_id,
                "start_location_id": "loc_A203",
                "destination_location_id": f"loc_{target_room}",
            },
        ),
        "route",
    )
    if "instructions" not in route or not route["instructions"]:
        raise RuntimeError(f"Expected route instructions: {route}")

    print("Integration smoke passed:")
    print(f"- session_id: {session_id}")
    print(f"- next target: {target_room}")
    print(f"- map_available: {route.get('map_available')}")
    print(f"- instructions: {len(route['instructions'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
