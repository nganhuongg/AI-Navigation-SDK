"""VNPT SmartReader adapter tests."""

from __future__ import annotations


def test_vnpt_smartreader_uploads_then_calls_ocr(monkeypatch):
    from app.adapters import vnpt_smartreader
    from app.core.config import settings

    calls = []

    class FakeResponse:
        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self.payload

    def fake_post(url, headers, **kwargs):
        calls.append((url, headers, kwargs))
        if url.endswith("/file-service/v1/addFile"):
            assert headers["Token-id"] == "tid"
            assert headers["Token-key"] == "tkey"
            assert headers["Authorization"] == "Bearer token"
            assert headers["mac-address"] == "EGOV-DIGDOC-WEB-API"
            assert "file" in kwargs["files"]
            return FakeResponse({"object": {"hash": "hash-123", "fileName": "form.png"}})
        if url.endswith("/rpa-service/aidigdoc/v1/ocr/scan-table"):
            assert kwargs["json"]["file_hash"] == "hash-123"
            assert kwargs["json"]["details"] is True
            return FakeResponse(
                {
                    "status": "OK",
                    "statusCode": 200,
                    "object": {
                        "tables": [
                            {
                                "rows": [
                                    {
                                        "cells": [
                                            {"text": "1", "confidence_score": 0.9},
                                            {"text": "Phong kham\nA203", "confidence_score": 0.9},
                                            {"text": "29", "confidence_score": 0.9},
                                            {"text": "Mang theo\nphieu chi dinh", "confidence_score": 0.8},
                                        ],
                                    },
                                ],
                            }
                        ],
                        "warnings": [],
                        "num_of_pages": 1,
                    },
                }
            )
        raise AssertionError(f"unexpected URL {url}")

    monkeypatch.setattr(settings, "vnpt_smartreader_base_url", "VNPT_BASE_URL=https://api.idg.vnpt.vn")
    monkeypatch.setattr(settings, "vnpt_smartreader_token_id", "tid")
    monkeypatch.setattr(settings, "vnpt_smartreader_token_key", "tkey")
    monkeypatch.setattr(settings, "vnpt_smartreader_access_token", "token")
    monkeypatch.setattr(settings, "vnpt_smartreader_ocr_path", "/rpa-service/aidigdoc/v1/ocr/scan-table")
    monkeypatch.setattr(vnpt_smartreader.httpx, "post", fake_post)

    result = vnpt_smartreader.read(b"image", "form.png")

    assert len(calls) == 2
    assert "1\tPhong kham A203\t29\tMang theo phieu chi dinh" in result["text"]
    assert round(result["confidence"], 2) == 0.88


def test_vnpt_smartreader_can_call_scan_table(monkeypatch):
    from app.adapters import vnpt_smartreader
    from app.core.config import settings

    calls = []

    class FakeResponse:
        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self.payload

    def fake_post(url, headers, **kwargs):
        calls.append((url, headers, kwargs))
        if url.endswith("/file-service/v1/addFile"):
            return FakeResponse({"object": {"hash": "hash-123", "fileName": "form.png"}})
        if url.endswith("/rpa-service/aidigdoc/v1/ocr/scan-table"):
            return FakeResponse(
                {
                    "status": "OK",
                    "statusCode": 200,
                    "object": {
                        "tables": [
                            {
                                "rows": [
                                    {
                                        "cells": [
                                            {"text": "2"},
                                            {"text": "Xet nghiem mau"},
                                            {"text": "Phong Lay mau 2 - A304"},
                                            {"text": "46"},
                                            {"text": "Mang theo phieu chi dinh."},
                                        ]
                                    }
                                ]
                            }
                        ]
                    },
                }
            )
        raise AssertionError(f"unexpected URL {url}")

    monkeypatch.setattr(settings, "vnpt_smartreader_base_url", "https://api.idg.vnpt.vn")
    monkeypatch.setattr(settings, "vnpt_smartreader_token_id", "tid")
    monkeypatch.setattr(settings, "vnpt_smartreader_token_key", "tkey")
    monkeypatch.setattr(settings, "vnpt_smartreader_access_token", "token")
    monkeypatch.setattr(vnpt_smartreader.httpx, "post", fake_post)

    result = vnpt_smartreader.read(
        b"image",
        "form.png",
        ocr_path="/rpa-service/aidigdoc/v1/ocr/scan-table",
    )

    assert calls[1][0].endswith("/rpa-service/aidigdoc/v1/ocr/scan-table")
    assert "Xet nghiem mau\tPhong Lay mau 2 - A304\t46\tMang theo phieu chi dinh." in result["text"]
