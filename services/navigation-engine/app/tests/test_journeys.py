"""Phase 1 tests: care journey templates are listed and fetchable."""

from __future__ import annotations


def test_list_templates(client):
    response = client.get("/journey-templates")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    ids = {t["template_id"] for t in body["data"]}
    assert "standard_outpatient_v1" in ids


def test_get_one_template(client):
    response = client.get("/journey-templates/standard_outpatient_v1")
    assert response.status_code == 200
    doc = response.json()["data"]
    assert doc["template_id"] == "standard_outpatient_v1"
    # The blank patient-journey state is present.
    assert doc["patient_journey_template"]["current_step"] == "waiting_for_doctor"


def test_missing_template_404(client):
    response = client.get("/journey-templates/nope_v9")
    assert response.status_code == 404
    assert response.json()["success"] is False


def test_update_template_requires_matching_id(client):
    doc = client.get("/journey-templates/standard_outpatient_v1").json()["data"]
    doc["template_id"] = "different_template"

    response = client.put("/journey-templates/standard_outpatient_v1", json=doc)

    assert response.status_code == 422
    assert response.json()["success"] is False
