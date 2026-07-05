"""SmartBot proxy endpoint tests."""

from __future__ import annotations


def _request_body():
    return {
        "session_id": "session_001",
        "sender_id": "patient_001",
        "text": "Toi vua kham xong thi di dau?",
        "metadata": {
            "current_step": "kham ban dau da hoan thanh",
            "target_room": "D405",
            "target_floor": "4",
            "next_action": "di xet nghiem mau",
            "accessibility_mode": "normal",
        },
    }


def test_chatbot_proxy_builds_smartbot_payload(client, monkeypatch):
    from app.core.config import settings
    from app.services.chatbot import smartbot_proxy

    captured = {}

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json"}

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "object": {
                    "sb": {
                        "intent_name": "ask_next_step",
                        "card_data": [
                            {"type": "text", "text": "Bac den phong D405."},
                            {"type": "button", "title": "Chi duong", "buttons": [{"title": "Mo ban do"}]},
                        ],
                    }
                }
            }

    def fake_post(url, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return FakeResponse()

    monkeypatch.setattr(settings, "use_vnpt_smartbot", True)
    monkeypatch.setattr(settings, "vnpt_access_token", "token")
    monkeypatch.setattr(settings, "vnpt_token_id", "tid")
    monkeypatch.setattr(settings, "vnpt_token_key", "tkey")
    monkeypatch.setattr(settings, "vnpt_smartbot_bot_id", "bot-123")
    monkeypatch.setattr(settings, "vnpt_smartbot_url", "https://assistant-stream.vnpt.vn/v1/conversation")
    monkeypatch.setattr(smartbot_proxy.httpx, "post", fake_post)

    response = client.post("/api/chatbot/message", json=_request_body())

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["reply_text"] == "Bac den phong D405.\nChi duong"
    assert data["intent_name"] == "ask_next_step"
    assert data["handoff_required"] is False
    assert captured["url"] == "https://assistant-stream.vnpt.vn/v1/conversation"
    assert captured["headers"]["Authorization"] == "Bearer token"
    assert captured["headers"]["Token-id"] == "tid"
    assert captured["headers"]["Token-key"] == "tkey"
    payload = captured["json"]
    assert payload["bot_id"] == "bot-123"
    assert payload["input_channel"] == "livechat"
    assert payload["metadata"]["button_variables"] == [
        {"variableName": "current_step", "value": "kham ban dau da hoan thanh"},
        {"variableName": "target_room", "value": "D405"},
        {"variableName": "target_floor", "value": "4"},
        {"variableName": "next_action", "value": "di xet nghiem mau"},
        {"variableName": "accessibility_mode", "value": "normal"},
    ]
    assert "settings" not in payload


def test_chatbot_proxy_can_send_local_prompts_when_enabled(client, monkeypatch):
    from app.core.config import settings
    from app.services.chatbot import smartbot_proxy

    captured = {}

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json"}

        def raise_for_status(self):
            return None

        def json(self):
            return {"object": {"sb": {"card_data": [{"type": "text", "text": "Bac den phong D405."}]}}}

    def fake_post(url, headers, json, timeout):
        captured["json"] = json
        return FakeResponse()

    monkeypatch.setattr(settings, "use_vnpt_smartbot", True)
    monkeypatch.setattr(settings, "vnpt_smartbot_use_local_prompts", True)
    monkeypatch.setattr(settings, "vnpt_access_token", "token")
    monkeypatch.setattr(settings, "vnpt_token_id", "tid")
    monkeypatch.setattr(settings, "vnpt_token_key", "tkey")
    monkeypatch.setattr(settings, "vnpt_smartbot_bot_id", "bot-123")
    monkeypatch.setattr(smartbot_proxy.httpx, "post", fake_post)

    response = client.post("/api/chatbot/message", json=_request_body())

    assert response.status_code == 200
    payload = captured["json"]
    assert "system_prompt" in payload["settings"]
    assert "advance_prompt" in payload["settings"]


def test_chatbot_proxy_parses_smartbot_sse_stream(client, monkeypatch):
    from app.core.config import settings
    from app.services.chatbot import smartbot_proxy

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        headers = {"content-type": "text/event-stream;charset=UTF-8"}
        text = (
            'data:{"object":{"sb":{"intent_name":"","card_data":[{"type":"text","text":"Sau"}]}}}\n\n'
            'data:{"object":{"sb":{"intent_name":"ask_next_step","card_data":[{"type":"text","text":"Sau khi hoàn thành khám, bác đến D405."}]}}}\n\n'
        )

        def raise_for_status(self):
            return None

        def json(self):
            raise AssertionError("SSE responses must not call response.json() directly")

    monkeypatch.setattr(settings, "use_vnpt_smartbot", True)
    monkeypatch.setattr(settings, "vnpt_access_token", "token")
    monkeypatch.setattr(settings, "vnpt_token_id", "tid")
    monkeypatch.setattr(settings, "vnpt_token_key", "tkey")
    monkeypatch.setattr(settings, "vnpt_smartbot_bot_id", "bot-123")
    monkeypatch.setattr(smartbot_proxy.httpx, "post", lambda *args, **kwargs: FakeResponse())

    data = client.post("/api/chatbot/message", json=_request_body()).json()["data"]

    assert data["reply_text"] == "Sau khi hoàn thành khám, bác đến D405."
    assert data["intent_name"] == "ask_next_step"
    assert data["handoff_required"] is False


def test_chatbot_proxy_overrides_ungrounded_smartbot_reply_with_metadata(client, monkeypatch):
    from app.core.config import settings
    from app.services.chatbot import smartbot_proxy

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json"}

        def raise_for_status(self):
            return None

        def json(self):
            return {"object": {"sb": {"card_data": [{"type": "text", "text": "Bac den phong A227."}]}}}

    monkeypatch.setattr(settings, "use_vnpt_smartbot", True)
    monkeypatch.setattr(settings, "vnpt_access_token", "token")
    monkeypatch.setattr(settings, "vnpt_token_id", "tid")
    monkeypatch.setattr(settings, "vnpt_token_key", "tkey")
    monkeypatch.setattr(settings, "vnpt_smartbot_bot_id", "bot-123")
    monkeypatch.setattr(smartbot_proxy.httpx, "post", lambda *args, **kwargs: FakeResponse())

    data = client.post("/api/chatbot/message", json=_request_body()).json()["data"]

    assert "D405" in data["reply_text"]
    assert "di xet nghiem mau" in data["reply_text"]
    assert "A227" not in data["reply_text"]


def test_chatbot_proxy_keeps_knowledge_base_reply_for_non_navigation_question(client, monkeypatch):
    from app.core.config import settings
    from app.services.chatbot import smartbot_proxy

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json"}

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "object": {
                    "sb": {
                        "card_data": [
                            {
                                "type": "text",
                                "text": "Khi đi xét nghiệm máu, bác mang theo phiếu chỉ định và chờ gọi số thứ tự.",
                            }
                        ]
                    }
                }
            }

    body = _request_body()
    body["text"] = "Khi đi xét nghiệm máu cần mang giấy gì?"
    monkeypatch.setattr(settings, "use_vnpt_smartbot", True)
    monkeypatch.setattr(settings, "vnpt_access_token", "token")
    monkeypatch.setattr(settings, "vnpt_token_id", "tid")
    monkeypatch.setattr(settings, "vnpt_token_key", "tkey")
    monkeypatch.setattr(settings, "vnpt_smartbot_bot_id", "bot-123")
    monkeypatch.setattr(smartbot_proxy.httpx, "post", lambda *args, **kwargs: FakeResponse())

    data = client.post("/api/chatbot/message", json=body).json()["data"]

    assert "phiếu chỉ định" in data["reply_text"]
    assert "D405" not in data["reply_text"]


def test_chatbot_proxy_marks_handoff_card(client, monkeypatch):
    from app.core.config import settings
    from app.services.chatbot import smartbot_proxy

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json"}

        def raise_for_status(self):
            return None

        def json(self):
            return {"object": {"sb": {"card_data": [{"type": "chuyen_gdv", "text": "Gap nhan vien."}]}}}

    monkeypatch.setattr(settings, "use_vnpt_smartbot", True)
    monkeypatch.setattr(settings, "vnpt_access_token", "token")
    monkeypatch.setattr(settings, "vnpt_token_id", "tid")
    monkeypatch.setattr(settings, "vnpt_token_key", "tkey")
    monkeypatch.setattr(settings, "vnpt_smartbot_bot_id", "bot-123")
    monkeypatch.setattr(smartbot_proxy.httpx, "post", lambda *args, **kwargs: FakeResponse())

    data = client.post("/api/chatbot/message", json=_request_body()).json()["data"]

    assert data["handoff_required"] is True
    assert data["reply_text"] == "Gap nhan vien."


def test_chatbot_proxy_401_returns_clear_error_as_data(client, monkeypatch):
    from app.core.config import settings
    from app.services.chatbot import smartbot_proxy

    class FakeResponse:
        status_code = 401
        headers = {"content-type": "application/json"}

        def raise_for_status(self):
            raise AssertionError("should not be called for 401")

    monkeypatch.setattr(settings, "use_vnpt_smartbot", True)
    monkeypatch.setattr(settings, "vnpt_access_token", "bad")
    monkeypatch.setattr(settings, "vnpt_token_id", "tid")
    monkeypatch.setattr(settings, "vnpt_token_key", "tkey")
    monkeypatch.setattr(settings, "vnpt_smartbot_bot_id", "bot-123")
    monkeypatch.setattr(smartbot_proxy.httpx, "post", lambda *args, **kwargs: FakeResponse())

    response = client.post("/api/chatbot/message", json=_request_body())

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["reply_text"] == "VNPT authentication failed"
    assert data["handoff_required"] is True


def test_chatbot_proxy_missing_card_data_uses_local_engine_answer(client, monkeypatch):
    from app.core.config import settings
    from app.services.chatbot import smartbot_proxy

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json"}

        def raise_for_status(self):
            return None

        def json(self):
            return {"object": {"sb": {"intent_name": "unknown"}}}

    monkeypatch.setattr(settings, "use_vnpt_smartbot", True)
    monkeypatch.setattr(settings, "vnpt_access_token", "token")
    monkeypatch.setattr(settings, "vnpt_token_id", "tid")
    monkeypatch.setattr(settings, "vnpt_token_key", "tkey")
    monkeypatch.setattr(settings, "vnpt_smartbot_bot_id", "bot-123")
    monkeypatch.setattr(smartbot_proxy.httpx, "post", lambda *args, **kwargs: FakeResponse())

    data = client.post("/api/chatbot/message", json=_request_body()).json()["data"]

    assert data["handoff_required"] is False
    assert data["intent_name"] == "metadata_fallback"
    assert "D405" in data["reply_text"]


def test_chatbot_proxy_mock_mode_answers_route_question(client):
    body = {
        "session_id": "session_001",
        "sender_id": "patient_001",
        "text": "quầy đăng ký khám ở đâu",
        "metadata": {},
    }

    response = client.post("/api/chatbot/message", json=body)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["intent_name"] == "ask_route"
    assert data["handoff_required"] is False
    assert "đăng ký" in data["reply_text"].lower()
