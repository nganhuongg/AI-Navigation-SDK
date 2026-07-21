"""Phase 3 tests: OCR extraction (mock adapter) and wiring into confirm-ocr."""

from __future__ import annotations

DUMMY_IMAGE = {"file": ("form.png", b"fake-image-bytes", "image/png")}


def _data(response):
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_extract_clear_form(client):
    result = _data(client.post("/ocr/extract", files=DUMMY_IMAGE, data={"scenario": "clear"}))
    assert result["confidence"] == 0.92
    assert result["is_low_confidence"] is False
    assert result["requires_user_confirmation"] is True
    fields = result["fields"]
    assert fields["detected_room_codes"] == ["A203", "A303", "A311"]
    assert fields["initial_exam_room"] == "A203"
    assert fields["ordered_services"] == ["blood_collection", "general_ultrasound"]
    assert fields["return_room"] == "A203"
    assert fields["room_descriptions"]["A303"]
    assert fields["room_descriptions"]["A311"]
    assert isinstance(fields["room_queue_numbers"], dict)


def test_extract_blurry_form_is_low_confidence(client):
    result = _data(client.post("/ocr/extract", files=DUMMY_IMAGE, data={"scenario": "blurry"}))
    assert result["confidence"] < 0.6
    assert result["is_low_confidence"] is True


def test_ocr_result_feeds_confirm_ocr(client):
    # Start a session and clear the reception checkpoints.
    sid = _data(client.post("/session/start"))["session_id"]
    for _ in range(3):
        client.post(f"/session/{sid}/arrive")

    # Extract fields from the form, then confirm them into the session.
    ocr = _data(client.post("/ocr/extract", files=DUMMY_IMAGE, data={"scenario": "clear"}))
    body = {"fields": ocr["fields"], "confidence": ocr["confidence"]}
    session = _data(client.post(f"/session/{sid}/confirm-ocr", json=body))

    service_ids = [s["service_id"] for s in session["journey"]["specialized_process"]["services"]]
    assert service_ids == ["room_A303", "room_A311", "return_doctor", "pharmacy"]
    rooms = [s["room"] for s in session["journey"]["specialized_process"]["services"]]
    assert rooms == ["A303", "A311", "A203", "A124"]
    # After OCR confirm, the next stop follows the first actual service room.
    assert session["next_action"]["target_room"] == "A303"


def test_schema_parser_detects_catalog_room_codes_with_ocr_spacing():
    from app.models.session import SpecializedProcess
    from app.services.journey import template_loader
    from app.services.ocr import schema_parser

    template = template_loader.get_template("standard_outpatient_v1")
    blueprint = SpecializedProcess(**template["specialized_process_blueprint"])

    parsed = schema_parser.parse_fields(
        "Phong kham A 203. Lay mau tai A-303. Sieu am phong A.311.",
        blueprint,
    )

    assert parsed["detected_room_codes"] == ["A203", "A303", "A311"]
    assert parsed["initial_exam_room"] == "A203"
    assert parsed["ordered_services"] == ["blood_collection", "general_ultrasound"]
    assert parsed["return_room"] == "A203"
    assert parsed["room_descriptions"]["A303"] == "Lay mau"
    assert parsed["room_descriptions"]["A311"] == "Sieu am"


def test_schema_parser_keeps_table_notes_per_room():
    from app.models.session import SpecializedProcess
    from app.services.journey import template_loader
    from app.services.ocr import schema_parser

    template = template_loader.get_template("standard_outpatient_v1")
    blueprint = SpecializedProcess(**template["specialized_process_blueprint"])

    parsed = schema_parser.parse_fields(
        "\n".join(
            [
                "1\tKham chuyen khoa Noi tiet\tPhong kham Noi tiet 1 - A207 - Tang 2 - Khu A\t29\t-",
                "2\tXet nghiem mau: Cong thuc mau, Duong huyet doi\tPhong Lay mau 2 - A304 - Tang 3 - Khu A\t46\tMang theo phieu chi dinh.",
                "3\tXet nghiem nuoc tieu toan phan\tPhong XN nuoc tieu - A305 - Tang 3 - Khu A\t13\tLay mau theo huong dan cua nhan vien va uong du nuoc truoc khi lay mau.",
            ]
        ),
        blueprint,
    )

    assert parsed["detected_room_codes"] == ["A207", "A304", "A305"]
    assert parsed["room_descriptions"]["A304"] == "Xet nghiem mau: Cong thuc mau, Duong huyet doi"
    assert parsed["room_descriptions"]["A305"] == "Xet nghiem nuoc tieu toan phan"
    assert (
        parsed["room_notes"]["A304"]
        == "Xet nghiem mau: Cong thuc mau, Duong huyet doi. Ghi chu: Mang theo phieu chi dinh"
    )
    assert (
        parsed["room_notes"]["A305"]
        == "Xet nghiem nuoc tieu toan phan. Ghi chu: Lay mau theo huong dan cua nhan vien va uong du nuoc truoc khi lay mau"
    )
    assert parsed["room_queue_numbers"] == {"A207": "29", "A304": "46", "A305": "13"}
    assert "A305" not in parsed["room_notes"]["A304"]


def test_confirm_ocr_builds_dynamic_journey_from_detected_room_codes(client):
    sid = _data(client.post("/session/start"))["session_id"]
    body = {
        "fields": {
            "initial_exam_room": "A207",
            "return_room": "A207",
            "detected_room_codes": ["A207", "A304", "A305"],
            "room_descriptions": {
                "A207": "Kham tieu hoa",
                "A304": "Xet nghiem mau",
                "A305": "Xet nghiem nuoc tieu",
            },
            "room_notes": {"A305": "Lay mau truoc khi sieu am"},
            "room_queue_numbers": {"A207": "29", "A304": "46", "A305": "13"},
            "completed_steps": ["register", "identity", "payment"],
        },
        "confidence": 0.98,
    }

    session = _data(client.post(f"/session/{sid}/confirm-ocr", json=body))

    extracted = session["journey"]["extracted_fields"]
    assert extracted["detected_room_codes"] == ["A207", "A304", "A305"]
    assert extracted["room_descriptions"]["A304"] == "Xet nghiem mau"
    assert extracted["room_notes"]["A305"] == "Lay mau truoc khi sieu am"
    assert extracted["room_queue_numbers"] == {"A207": "29", "A304": "46", "A305": "13"}
    services = session["journey"]["specialized_process"]["services"]
    assert [service["service_id"] for service in services] == [
        "room_A304",
        "room_A305",
        "return_doctor",
        "pharmacy",
    ]
    assert [service["room"] for service in services] == ["A304", "A305", "A207", "A124"]
    assert services[0]["room_name"]
    assert services[0]["service_name"] == "Xet nghiem mau"
    assert "Ghi chu" in services[1]["description"]
    assert services[2]["service_id"] == "return_doctor"
    assert session["next_action"]["target_room"] == "A304"
