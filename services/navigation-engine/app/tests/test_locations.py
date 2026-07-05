"""Phase 1 tests: the location catalog is served from locations.json."""

from __future__ import annotations


def test_list_returns_all_locations(client):
    response = client.get("/locations")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    # locations.json currently holds 121 POIs.
    assert len(body["data"]) == 121
    poi_codes = {loc["poi_id"] for loc in body["data"]}
    assert {"A203", "A303", "A311", "A124"}.issubset(poi_codes)


def test_get_one_by_room_code(client):
    response = client.get("/locations/A303")
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "Phòng lấy máu 1"


def test_get_one_by_internal_id(client):
    response = client.get("/locations/loc_A124")
    assert response.status_code == 200
    assert response.json()["data"]["poi_id"] == "A124"


def test_missing_location_returns_404_envelope(client):
    response = client.get("/locations/DOES_NOT_EXIST")
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["error"]


def test_match_free_text_to_location(client):
    response = client.get("/locations/match", params={"q": "lấy máu"})
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    # "lấy máu" should resolve to a blood-collection room (A303 or A304).
    assert "máu" in body["data"]["location"]["name"].lower()
