"""VNPT SmartBot adapter tests."""

from __future__ import annotations


def test_vnpt_smartbot_maps_conversation_intent(monkeypatch):
    from app.adapters import vnpt_smartbot
    from app.core.config import settings

    class FakeResponse:
        headers = {"content-type": "application/json"}

        def raise_for_status(self):
            return None

        def json(self):
            return {"object": {"sb": {"intent_name": "chi_duong", "card_data": []}}}

    def fake_post(url, headers, json, timeout):
        assert url == "https://assistant-stream.vnpt.vn/v1/conversation"
        assert headers["Token-id"] == "tid"
        assert headers["Token-key"] == "tkey"
        assert headers["Authorization"] == "Bearer token"
        assert json["bot_id"] == "bot-123"
        assert json["input_channel"] == "livechat"
        return FakeResponse()

    monkeypatch.setattr(settings, "vnpt_smartbot_base_url", "https://assistant-stream.vnpt.vn")
    monkeypatch.setattr(settings, "vnpt_smartbot_token_id", "tid")
    monkeypatch.setattr(settings, "vnpt_smartbot_token_key", "tkey")
    monkeypatch.setattr(settings, "vnpt_smartbot_access_token", "token")
    monkeypatch.setattr(settings, "vnpt_smartbot_bot_id", "bot-123")
    monkeypatch.setattr(vnpt_smartbot.httpx, "post", fake_post)

    intent, confidence = vnpt_smartbot.classify("cho toi hoi duong")

    assert intent == "ask_route"
    assert confidence == 0.7
