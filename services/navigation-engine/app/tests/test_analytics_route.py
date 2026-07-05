"""Phase 6 tests: analytics endpoints and route text stub."""

from __future__ import annotations


def _data(response):
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_log_event_and_dashboard_summary(client):
    event = _data(
        client.post(
            "/events/log",
            json={
                "event_type": "step_completed",
                "session_id": "sess_test_analytics",
                "metadata": {"location_id": "loc_A303"},
            },
        )
    )
    assert event["event_id"].startswith("evt_")

    summary = _data(client.get("/dashboard/summary"))
    assert summary["total_steps_completed"] >= 1
    assert any(item["location_id"] == "loc_A303" for item in summary["top_locations"])


def test_route_stub_returns_text_directions_and_logs_event(client):
    from app.services.map_digitization import digitizer

    digitizer.delete_map_files_for_test("bachmai_main_multifloor_v1")
    route = _data(
        client.post(
            "/route",
            json={
                "session_id": "sess_route_test",
                "start_location_id": "loc_A101",
                "destination_location_id": "loc_A303",
            },
        )
    )
    assert route["map_available"] is False
    assert route["destination_room"] == "A303"
    assert route["instructions"]
    _data(client.post("/maps/digitize", json={"map_id": "bachmai_main_multifloor_v1", "floor_numbers": [1, 2, 3]}))
    _data(client.post("/maps/bachmai_main_multifloor_v1/confirm"))

    summary = _data(client.get("/dashboard/summary"))
    assert summary["total_routes_requested"] >= 1


def test_route_can_use_session_next_action(client):
    session = _data(client.post("/session/start"))
    route = _data(client.post("/route", json={"session_id": session["session_id"]}))
    assert route["destination_location_id"] == "loc_A101"
    assert route["destination_room"] == "A101"
