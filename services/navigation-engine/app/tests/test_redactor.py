"""Focused tests for MVP privacy redaction."""

from __future__ import annotations

from app.services.privacy import redactor


def test_redactor_strips_common_form_identity_fields():
    raw = (
        "Ho ten: Nguyen Van A\tPhong A303\n"
        "Ngay sinh: 01/02/1950\n"
        "Ma BN: BN1234567\n"
        "BHYT: AB1234567890123\n"
        "SDT: 0912345678\n"
        "CCCD: 012345678901"
    )

    out = redactor.redact_text(raw)

    assert "Nguyen Van A" not in out
    assert "01/02/1950" not in out
    assert "BN1234567" not in out
    assert "AB1234567890123" not in out
    assert "0912345678" not in out
    assert "012345678901" not in out
    assert "Phong A303" in out
