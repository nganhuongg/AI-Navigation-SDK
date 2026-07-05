"""Map digitization and verified graph routing tests."""

from __future__ import annotations

from app.services.map_digitization import digitizer


def _data(response):
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    return body["data"]


def test_digitize_confirm_and_get_floor_image(client):
    map_id = "test_multifloor_map"
    digitizer.delete_map_files_for_test(map_id)

    draft = _data(
        client.post(
            "/maps/digitize",
            json={"map_id": map_id, "floor_numbers": [1, 2, 3]},
        )
    )
    assert draft["status"] == "draft"
    assert len(draft["floors"]) == 3
    assert len(draft["nodes"]) > 100
    assert len(draft["edges"]) > 100
    assert any(poi["poi_id"] == "A303" for poi in draft["pois"])

    verified = _data(client.post(f"/maps/{map_id}/confirm"))
    assert verified["status"] == "verified"
    assert verified["verified_at"]

    image = client.get(f"/maps/{map_id}/floor/2/image")
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"

    digitizer.delete_map_files_for_test(map_id)


def test_route_uses_verified_map_after_confirmation(client):
    map_id = "bachmai_main_multifloor_v1"
    digitizer.delete_map_files_for_test(map_id)
    _data(client.post("/maps/digitize", json={"map_id": map_id, "floor_numbers": [1, 2, 3]}))
    _data(client.post(f"/maps/{map_id}/confirm"))

    route = _data(
        client.post(
            "/route",
            json={
                "session_id": "sess_map_route_test",
                "start_location_id": "loc_A203",
                "destination_location_id": "loc_A303",
            },
        )
    )
    assert route["map_available"] is True
    assert route["start_room"] == "A203"
    assert route["destination_room"] == "A303"
    assert route["node_path"]
    assert route["polyline"]
    assert {point["floor"] for point in route["polyline"]} == {2.0, 3.0}
    assert any(
        node_id.startswith(("node_ELEV-", "node_STAIR-"))
        for node_id in route["node_path"]
    )

    digitizer.delete_map_files_for_test(map_id)
