"""Phase 4 tests: chatbot intents, safety refusal, and PII redaction."""

from __future__ import annotations


def _ask(client, message, session_id=None):
    body = {"message": message}
    if session_id:
        body["session_id"] = session_id
    response = client.post("/assistant/ask", json=body)
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_route_question_blood_test(client):
    # Colloquial "thử máu" should resolve to the blood collection room A303.
    data = _ask(client, "tôi đi thử máu ở đâu?")
    assert data["intent"] == "ask_route"
    assert data["target_room"] == "A303"
    assert "A303" in data["response_text"]


def test_route_question_pharmacy(client):
    data = _ask(client, "nhà thuốc ở đâu")
    assert data["intent"] == "ask_route"
    assert data["target_room"] == "A124"


def test_route_question_registration_desk(client):
    data = _ask(client, "quầy đăng ký khám ở đâu")
    assert data["intent"] == "ask_route"
    assert data["target_room"] in {"A104", "A105", "A106"}
    assert "đăng ký" in data["response_text"].lower()


def test_medical_advice_is_refused(client):
    data = _ask(client, "tôi đau ngực uống thuốc gì?")
    assert data["intent"] == "out_of_scope_medical"
    assert data["is_fallback"] is True
    assert "bác sĩ" in data["response_text"].lower()


def test_next_step_uses_session(client):
    sid = client.post("/session/start").json()["data"]["session_id"]
    data = _ask(client, "tôi làm gì tiếp theo?", sid)
    assert data["intent"] == "ask_next_step"
    assert data["target_room"] == "A101"  # fresh session → registration


def test_unknown_question_asks_to_clarify(client):
    data = _ask(client, "xin chào")
    assert data["is_fallback"] is True


def test_phone_number_is_redacted_but_question_still_answered(client):
    data = _ask(client, "số của tôi là 0912345678, nhà thuốc ở đâu")
    assert data["target_room"] == "A124"


def test_redactor_strips_phone_and_cccd():
    from app.services.privacy import redactor

    out = redactor.redact_text("gọi 0912345678 và cccd 012345678901 nhé")
    assert "0912345678" not in out
    assert "012345678901" not in out
