"""Phase 2 tests: the session/journey state machine.

Walks the full demo journey: reception checkpoints -> initial exam (scan) ->
confirm OCR -> specialized services -> done.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.storage import runtime_store


def _data(response):
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_full_journey_flow(client):
    session = _data(client.post("/session/start"))
    sid = session["session_id"]

    # Fresh session starts at registration (A101).
    assert session["next_action"]["type"] == "navigate"
    assert session["next_action"]["target_room"] == "A101"
    assert session["next_action"]["target_location_id"] == "loc_A101"

    # register -> identity (A103)
    session = _data(client.post(f"/session/{sid}/arrive"))
    assert session["next_action"]["target_room"] == "A103"
    # identity -> payment (A115)
    session = _data(client.post(f"/session/{sid}/arrive"))
    assert session["next_action"]["target_room"] == "A115"
    # payment -> initial exam / scan prompt
    session = _data(client.post(f"/session/{sid}/arrive"))
    assert session["next_action"]["type"] == "scan"
    assert session["journey"]["register"]["is_done"] is True
    assert session["journey"]["payment"]["is_done"] is True

    # Arriving while waiting for the doctor is a safe no-op (still prompts scan).
    session = _data(client.post(f"/session/{sid}/arrive"))
    assert session["next_action"]["type"] == "scan"

    # Confirm the scanned instruction form.
    body = {
        "fields": {
            "initial_exam_room": "A203",
            "ordered_services": ["blood_collection", "general_ultrasound"],
            "return_room": "A203",
            "specialty": "Tim mạch",
        },
        "confidence": 0.92,
    }
    session = _data(client.post(f"/session/{sid}/confirm-ocr", json=body))
    assert session["journey"]["specialized_process_updated"] is True
    assert session["journey"]["confidence_score"] == 0.92
    assert session["journey"]["extracted_fields"]["source"] == "ocr"
    service_ids = [s["service_id"] for s in session["journey"]["specialized_process"]["services"]]
    # OCR ordered 2 tests; return_doctor + pharmacy are appended as standard tail.
    assert service_ids == ["blood_collection", "general_ultrasound", "return_doctor", "pharmacy"]
    # Next stop is blood collection (A303).
    assert session["next_action"]["target_room"] == "A303"

    # Walk the specialized services.
    assert _data(client.post(f"/session/{sid}/arrive"))["next_action"]["target_room"] == "A311"
    assert _data(client.post(f"/session/{sid}/arrive"))["next_action"]["target_room"] == "A203"
    assert _data(client.post(f"/session/{sid}/arrive"))["next_action"]["target_room"] == "A124"
    done = _data(client.post(f"/session/{sid}/arrive"))
    assert done["next_action"]["type"] == "done"


def test_get_session_roundtrip(client):
    sid = _data(client.post("/session/start"))["session_id"]
    fetched = _data(client.get(f"/session/{sid}"))
    assert fetched["session_id"] == sid
    assert fetched["template_id"] == "standard_outpatient_v1"


def test_missing_session_returns_404(client):
    response = client.get("/session/sess_does_not_exist")
    assert response.status_code == 404
    assert response.json()["success"] is False


def test_expired_session_returns_410_and_is_deleted(client):
    session = _data(client.post("/session/start"))
    sid = session["session_id"]
    session["expires_at"] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    runtime_store.save_session(session)

    response = client.get(f"/session/{sid}")

    assert response.status_code == 410
    assert response.json()["success"] is False
    assert response.json()["error"] == "Session expired. Please start a new session."
    assert client.get(f"/session/{sid}").status_code == 404


def test_confirm_ocr_appends_standard_tail_when_no_tests_ordered(client):
    sid = _data(client.post("/session/start"))["session_id"]
    session = _data(client.post(f"/session/{sid}/confirm-ocr", json={"fields": {"ordered_services": []}}))
    ids = [s["service_id"] for s in session["journey"]["specialized_process"]["services"]]
    assert ids == ["return_doctor", "pharmacy"]


def test_apply_extracted_fields_supports_hospital_api_source(client):
    sid = _data(client.post("/session/start"))["session_id"]
    body = {
        "source": "hospital_api",
        "confidence": 1.0,
        "fields": {
            "initial_exam_room": "A203",
            "ordered_services": ["blood_collection"],
            "return_room": "A203",
            "completed_steps": ["register", "identity", "payment"],
        },
    }

    session = _data(client.post(f"/session/{sid}/apply-extracted-fields", json=body))

    extracted = session["journey"]["extracted_fields"]
    assert extracted["source"] == "hospital_api"
    assert extracted["completed_steps"] == ["register", "identity", "payment"]
    assert session["journey"]["register"]["is_done"] is True
    assert session["journey"]["identity"]["is_done"] is True
    assert session["journey"]["payment"]["is_done"] is True
    assert session["next_action"]["target_room"] == "A303"
