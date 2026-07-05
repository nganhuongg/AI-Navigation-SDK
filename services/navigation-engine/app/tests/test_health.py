"""Phase 0 test: the server is alive and returns the standard envelope."""

from __future__ import annotations


def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
    assert body["error"] is None
    assert "real" in body["data"]["services"]["ocr"]
