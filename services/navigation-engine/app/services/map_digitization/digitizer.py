"""Semi-automatic PNG floor-plan digitization.

The MVP uses the raw floor PNG dimensions plus the normalized POI catalog to
generate a reviewable draft graph. Admin confirmation is required before the
patient app or routing engine can use the graph.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from PIL import Image

from app.core.errors import NotFoundError, ValidationError
from app.core.paths import DRAFT_MAPS_DIR, RAW_DIR, VERIFIED_MAPS_DIR
from app.models.location import Location
from app.models.map import (
    DigitalMap,
    DigitizeMapRequest,
    MapEdge,
    MapFloor,
    MapListItem,
    MapNode,
    MapPOI,
    NodeAnchorUpdateRequest,
)
from app.storage.json_store import read_json, write_json
from app.services.locations import location_service

DEFAULT_MAP_ID = "bachmai_main_multifloor_v1"

Point = tuple[float, float]


def _row(
    codes: list[str],
    *,
    x1: float,
    x2: float,
    y: float,
) -> dict[str, Point]:
    """Return room-center anchors along one visual row, using image ratios."""
    if len(codes) == 1:
        return {codes[0]: ((x1 + x2) / 2, y)}
    return {
        code: (x1 + (x2 - x1) * (index / (len(codes) - 1)), y)
        for index, code in enumerate(codes)
    }


def _column(
    codes: list[str],
    *,
    x: float,
    y1: float,
    y2: float,
) -> dict[str, Point]:
    """Return room-center anchors along one visual column, using image ratios."""
    if len(codes) == 1:
        return {codes[0]: (x, (y1 + y2) / 2)}
    return {
        code: (x, y1 + (y2 - y1) * (index / (len(codes) - 1)))
        for index, code in enumerate(codes)
    }


def _ratio(x: float, y: float) -> Point:
    """Convert measured 2342x1656 demo-map pixels into image ratios."""
    return (x / 2342, y / 1656)


def _row_px(codes: list[str], *, x1: float, x2: float, y: float) -> dict[str, Point]:
    if len(codes) == 1:
        return {codes[0]: _ratio((x1 + x2) / 2, y)}
    return {
        code: _ratio(x1 + (x2 - x1) * (index / (len(codes) - 1)), y)
        for index, code in enumerate(codes)
    }


def _column_px(codes: list[str], *, x: float, y1: float, y2: float) -> dict[str, Point]:
    if len(codes) == 1:
        return {codes[0]: _ratio(x, (y1 + y2) / 2)}
    return {
        code: _ratio(x, y1 + (y2 - y1) * (index / (len(codes) - 1)))
        for index, code in enumerate(codes)
    }


def _points_px(items: dict[str, Point]) -> dict[str, Point]:
    return {code: _ratio(x, y) for code, (x, y) in items.items()}


def _floor_anchor_ratios(floor_number: int) -> dict[str, Point]:
    """Hand-tuned simulator anchors matching the demo floor-plan images.

    This is intentionally not presented as full automatic CV. It is the MVP
    equivalent of an admin dragging generated anchors onto the map once, then
    saving the reviewed result as a draft/verified digital map.
    """
    anchors: dict[str, Point] = {}

    if floor_number == 1:
        anchors.update(
            _points_px(
                {
                    "A101": (357.5, 701.5),
                    "A102": (469.5, 701.5),
                    "A103": (581, 701.5),
                    "A104": (692.5, 701.5),
                    "A105": (804.5, 701.5),
                    "A106": (916.5, 701.5),
                    "A107": (1027.5, 701.5),
                    "A108": (1138.5, 701.5),
                    "A109": (1258, 701.5),
                }
            )
        )
        anchors.update(_column_px(["A125", "A124"], x=220, y1=690, y2=750))
        anchors["WC-1A-M"] = _ratio(220, 914)
        anchors.update(_row_px(["WC-1A-F", "WC-1A-ACC"], x1=357.5, x2=469.5, y=983))
        anchors.update(
            _points_px(
                {
                    "A123": (581, 983),
                    "A122": (692.5, 983),
                    "A121": (804.5, 983),
                    "ELEV-1A": (916.5, 983),
                    "STAIR-1A": (1028, 983),
                    "A120": (1139.5, 983),
                    "A119": (1258, 983),
                }
            )
        )
        anchors.update(_row_px(["A110", "A111", "A112", "A113", "WC-1B-M", "WC-1B-F"], x1=1502.5, x2=2132, y=248.5))
        anchors.update(_row_px(["A118", "A117", "A116", "A115", "A114"], x1=1502.5, x2=2005.5, y=522.5))
        anchors.update(_column_px(["WC-1B-ACC", "STAIR-1B", "ELEV-1B"], x=2132, y1=310, y2=416))
        anchors["ENT-1-01"] = _ratio(220, 607)
        anchors["WAIT-1-CENTER"] = _ratio(804.5, 834.5)
        anchors["WAIT-1-BRANCH"] = _ratio(1754, 394)
        anchors["HALL-1-MAIN"] = _ratio(805, 772)
        anchors["HALL-1-BRANCH"] = _ratio(1380, 600)
        return anchors

    if floor_number == 2:
        anchors.update(
            _points_px(
                {
                    "A201": (215, 554.5),
                    "A202": (351, 554.5),
                    "A203": (469, 554.5),
                    "A204": (587, 554.5),
                    "A205": (719, 554.5),
                    "A206": (850, 554.5),
                    "A207": (968, 554.5),
                    "A208": (1087, 554.5),
                    "A209": (1205, 554.5),
                    "A210": (1323, 554.5),
                }
            )
        )
        anchors.update(_column_px(["A228", "A227", "WC-2A-M"], x=215, y1=554.5, y2=735.5))
        anchors.update(_row_px(["WC-2A-F", "WC-2A-ACC"], x1=351, x2=469, y=788))
        anchors.update(
            _points_px(
                {
                    "A226": (587, 788),
                    "A225": (719, 788),
                    "A224": (850, 788),
                    "ELEV-2A": (968, 788),
                    "STAIR-2A": (1087, 788),
                    "A223": (1205, 788),
                    "A222": (1323, 788),
                    "A221": (1380, 788),
                }
            )
        )
        anchors.update(_row_px(["A211", "A212", "A213", "A214", "WC-2B-M", "WC-2B-F"], x1=1434.5, x2=2136.5, y=242.5))
        anchors.update(_row_px(["A220", "A219", "A218", "A217", "A216", "A215"], x1=1545, x2=2137, y=459.5))
        anchors.update(_column_px(["WC-2B-ACC", "STAIR-2B", "ELEV-2B"], x=2136.5, y1=288.5, y2=375.5))
        anchors["WAIT-2-01"] = _ratio(837, 666.5)
        anchors["WAIT-2-02"] = _ratio(1781.5, 351)
        anchors["HALL-2-MAIN"] = _ratio(760, 600)
        anchors["HALL-2-BRANCH"] = _ratio(1435, 490)
        return anchors

    if floor_number == 3:
        anchors.update(
            _points_px(
                {
                    "A301": (348, 587.5),
                    "A302": (482.5, 587.5),
                    "A303": (631, 587.5),
                    "A304": (773, 587.5),
                    "A305": (902, 587.5),
                    "A306": (1019, 587.5),
                    "A307": (1135, 587.5),
                    "A308": (1251.5, 587.5),
                    "A309": (1380, 587.5),
                }
            )
        )
        anchors.update(_column_px(["WC-3A-M", "WC-3A-F", "WC-3A-ACC"], x=214.5, y1=665.5, y2=755))
        anchors.update(
            _points_px(
                {
                    "A326": (348, 807.5),
                    "A325": (482.5, 807.5),
                    "A324": (631, 807.5),
                    "A323": (773, 807.5),
                    "ELEV-3A": (902, 807.5),
                    "STAIR-3A": (1019, 807.5),
                    "A322": (1135, 807.5),
                    "A321": (1251.5, 807.5),
                    "A320": (1380, 807.5),
                    "A310": (1610, 248.5),
                    "A311": (1714, 248.5),
                    "A312": (1800.5, 248.5),
                    "A313": (1902, 248.5),
                    "WC-3B-M": (2021.5, 248.5),
                    "WC-3B-F": (2138, 248.5),
                    "A319": (1610, 486.5),
                    "A318": (1714, 486.5),
                    "A317": (1800.5, 486.5),
                    "A316": (1902, 486.5),
                    "A315": (2021.5, 486.5),
                    "A314": (2138, 486.5),
                }
            )
        )
        anchors.update(_column_px(["WC-3B-ACC", "STAIR-3B", "ELEV-3B"], x=2138, y1=300, y2=388.5))
        anchors["WAIT-3-01"] = _ratio(857.5, 688)
        anchors["WAIT-3-02"] = _ratio(1816, 364.5)
        anchors["HALL-3-MAIN"] = _ratio(870, 612)
        anchors["HALL-3-BRANCH"] = _ratio(1480, 560)
        return anchors

    return anchors


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _map_path(map_id: str, status: str) -> Path:
    base = VERIFIED_MAPS_DIR if status == "verified" else DRAFT_MAPS_DIR
    return base / f"{map_id}.json"


def _read_image_size(path: Path) -> tuple[int, int]:
    if not path.exists():
        raise NotFoundError(f"Floor-plan image not found: {path.name}")
    with Image.open(path) as image:
        return image.size


def _edge(node_a: MapNode, node_b: MapNode, kind: str = "walkway", weight: float | None = None) -> MapEdge:
    distance = math.dist((node_a.x, node_a.y), (node_b.x, node_b.y))
    return MapEdge(
        edge_id=f"edge_{node_a.node_id}_{node_b.node_id}",
        from_node=node_a.node_id,
        to_node=node_b.node_id,
        weight=round(weight if weight is not None else distance, 2),
        kind=kind,  # type: ignore[arg-type]
    )


def _locations_for_floor(locations: Iterable[Location], floor_number: int) -> list[Location]:
    return sorted(
        [location for location in locations if location.floor_number == floor_number],
        key=lambda item: item.poi_id,
    )


def _point(width: int, height: int, ratio: Point) -> Point:
    return (round(width * ratio[0], 2), round(height * ratio[1], 2))


def _corridor_node(
    floor_number: int,
    name: str,
    width: int,
    height: int,
    ratio: Point,
    label: str,
    kind: str = "corridor",
) -> MapNode:
    x, y = _point(width, height, ratio)
    return MapNode(
        node_id=f"f{floor_number}_{name}",
        x=x,
        y=y,
        floor_number=floor_number,
        kind=kind,  # type: ignore[arg-type]
        label=label,
    )


def _floor_skeleton(floor_number: int, width: int, height: int) -> tuple[list[MapNode], list[MapEdge]]:
    """Create the walkable L-shaped corridor graph visible on the floor images."""
    measured_by_floor: dict[int, dict[str, Point]] = {
        1: {
            "main_left_top": _ratio(220, 762),
            "main_mid_top": _ratio(805, 762),
            "main_right_top": _ratio(1320, 762),
            "main_left_bottom": _ratio(220, 914),
            "main_mid_bottom": _ratio(805, 914),
            "main_right_bottom": _ratio(1320, 914),
            "branch_bottom": _ratio(1380, 914),
            "branch_top": _ratio(1380, 248),
            "upper_left_top": _ratio(1500, 310),
            "upper_mid_top": _ratio(1815, 310),
            "upper_right_top": _ratio(2132, 310),
            "upper_left_bottom": _ratio(1500, 470),
            "upper_mid_bottom": _ratio(1815, 470),
            "upper_right_bottom": _ratio(2132, 470),
            "elevator_a": _ratio(918, 945),
            "stairs_a": _ratio(1030, 945),
            "elevator_b": _ratio(2132, 416),
            "stairs_b": _ratio(2132, 360),
        },
        2: {
            "main_left_top": _ratio(215, 600),
            "main_mid_top": _ratio(837, 600),
            "main_right_top": _ratio(1380, 600),
            "main_left_bottom": _ratio(215, 735),
            "main_mid_bottom": _ratio(837, 735),
            "main_right_bottom": _ratio(1380, 735),
            "branch_bottom": _ratio(1435, 735),
            "branch_top": _ratio(1435, 242),
            "upper_left_top": _ratio(1545, 289),
            "upper_mid_top": _ratio(1782, 289),
            "upper_right_top": _ratio(2137, 289),
            "upper_left_bottom": _ratio(1545, 410),
            "upper_mid_bottom": _ratio(1782, 410),
            "upper_right_bottom": _ratio(2137, 410),
            "elevator_a": _ratio(970, 760),
            "stairs_a": _ratio(1087, 760),
            "elevator_b": _ratio(2137, 375),
            "stairs_b": _ratio(2137, 337),
        },
        3: {
            "main_left_top": _ratio(215, 626),
            "main_mid_top": _ratio(858, 626),
            "main_right_top": _ratio(1450, 626),
            "main_left_bottom": _ratio(215, 755),
            "main_mid_bottom": _ratio(858, 755),
            "main_right_bottom": _ratio(1450, 755),
            "branch_bottom": _ratio(1500, 755),
            "branch_top": _ratio(1500, 248),
            "upper_left_top": _ratio(1610, 300),
            "upper_mid_top": _ratio(1816, 300),
            "upper_right_top": _ratio(2138, 300),
            "upper_left_bottom": _ratio(1610, 430),
            "upper_mid_bottom": _ratio(1816, 430),
            "upper_right_bottom": _ratio(2138, 430),
            "elevator_a": _ratio(902, 779),
            "stairs_a": _ratio(1019, 779),
            "elevator_b": _ratio(2138, 389),
            "stairs_b": _ratio(2138, 348),
        },
    }
    anchors = measured_by_floor.get(floor_number, measured_by_floor[1])
    nodes = [
        _corridor_node(floor_number, name, width, height, ratio, f"Floor {floor_number} {name}")
        for name, ratio in anchors.items()
    ]
    by_name = {node.node_id.removeprefix(f"f{floor_number}_"): node for node in nodes}

    pairs = [
        ("main_left_top", "main_mid_top"),
        ("main_mid_top", "main_right_top"),
        ("main_left_bottom", "main_mid_bottom"),
        ("main_mid_bottom", "main_right_bottom"),
        ("main_left_top", "main_left_bottom"),
        ("main_right_top", "main_right_bottom"),
        ("branch_bottom", "branch_top"),
        ("upper_left_top", "upper_mid_top"),
        ("upper_mid_top", "upper_right_top"),
        ("upper_left_bottom", "upper_mid_bottom"),
        ("upper_mid_bottom", "upper_right_bottom"),
        ("upper_left_top", "upper_left_bottom"),
        ("upper_right_top", "upper_right_bottom"),
        ("elevator_a", "main_mid_bottom"),
        ("stairs_a", "main_mid_bottom"),
        ("elevator_b", "upper_right_bottom"),
        ("stairs_b", "upper_right_bottom"),
    ]
    edges = [_edge(by_name[left], by_name[right]) for left, right in pairs]
    return nodes, edges


def _nearest_corridor_node(nodes: list[MapNode], target: Point) -> MapNode:
    corridor_nodes = [node for node in nodes if node.kind in {"corridor", "elevator", "stairs"}]
    return min(corridor_nodes, key=lambda node: math.dist((node.x, node.y), target))


def _location_kind(location: Location) -> str:
    if "elevator" in location.poi_type:
        return "elevator"
    if "stair" in location.poi_type:
        return "stairs"
    return "room"


def _build_floor(
    *,
    floor_number: int,
    width: int,
    height: int,
    locations: list[Location],
) -> tuple[list[MapNode], list[MapEdge], list[MapPOI]]:
    nodes, edges = _floor_skeleton(floor_number, width, height)
    pois: list[MapPOI] = []
    anchors = _floor_anchor_ratios(floor_number)

    for location in locations:
        ratio = anchors.get(location.poi_id)
        if ratio is None:
            # Fallback keeps new catalog rows visible even before manual placement.
            ratio = (0.50, 0.50)
        x, y = _point(width, height, ratio)
        kind = _location_kind(location)

        room_node = MapNode(
            node_id=f"node_{location.poi_id}",
            x=x,
            y=y,
            floor_number=floor_number,
            kind=kind,  # type: ignore[arg-type]
            location_id=location.location_id,
            poi_id=location.poi_id,
            label=location.label,
        )
        nearest = _nearest_corridor_node(nodes, (x, y))
        door_node = MapNode(
            node_id=f"door_{location.poi_id}",
            x=nearest.x,
            y=nearest.y,
            floor_number=floor_number,
            kind="corridor",
            label=f"Door to {location.poi_id}",
        )
        nodes.extend([door_node, room_node])
        edges.append(_edge(room_node, door_node, "door"))
        edges.append(_edge(door_node, nearest))
        pois.append(
            MapPOI(
                poi_id=location.poi_id,
                location_id=location.location_id,
                node_id=room_node.node_id,
                label=location.label,
                x=room_node.x,
                y=room_node.y,
                floor_number=floor_number,
            )
        )

    return nodes, edges, pois


def _connect_floors(nodes: list[MapNode], floor_numbers: list[int]) -> list[MapEdge]:
    by_id = {node.node_id: node for node in nodes}
    edges: list[MapEdge] = []
    for current, next_floor in zip(floor_numbers, floor_numbers[1:]):
        for connector in ("A", "B"):
            elevator_current = by_id.get(f"node_ELEV-{current}{connector}")
            elevator_next = by_id.get(f"node_ELEV-{next_floor}{connector}")
            if elevator_current is not None and elevator_next is not None:
                edges.append(_edge(elevator_current, elevator_next, "elevator", weight=80))

            stairs_current = by_id.get(f"node_STAIR-{current}{connector}")
            stairs_next = by_id.get(f"node_STAIR-{next_floor}{connector}")
            if stairs_current is not None and stairs_next is not None:
                edges.append(_edge(stairs_current, stairs_next, "stairs", weight=140))
    return edges


def digitize_map(request: DigitizeMapRequest) -> DigitalMap:
    """Create a draft multi-floor graph from raw PNGs and locations.json."""
    map_id = request.map_id or DEFAULT_MAP_ID
    floor_numbers = sorted(set(request.floor_numbers))
    if not floor_numbers:
        raise ValidationError("At least one floor_number is required")

    locations = location_service.list_locations()
    floors: list[MapFloor] = []
    nodes: list[MapNode] = []
    edges: list[MapEdge] = []
    pois: list[MapPOI] = []

    for floor_number in floor_numbers:
        source_image = request.source_image_pattern.format(floor=floor_number)
        image_path = RAW_DIR / source_image
        width, height = _read_image_size(image_path)
        floors.append(
            MapFloor(
                floor_id=f"floor_{floor_number}",
                floor_number=floor_number,
                image_width=width,
                image_height=height,
                source_image=source_image,
            )
        )
        floor_nodes, floor_edges, floor_pois = _build_floor(
            floor_number=floor_number,
            width=width,
            height=height,
            locations=_locations_for_floor(locations, floor_number),
        )
        nodes.extend(floor_nodes)
        edges.extend(floor_edges)
        pois.extend(floor_pois)

    edges.extend(_connect_floors(nodes, floor_numbers))

    digital_map = DigitalMap(
        map_id=map_id,
        hospital_id="bachmai_demo",
        building_id="building_main_a",
        status="draft",
        version=1,
        floors=floors,
        nodes=nodes,
        edges=edges,
        pois=pois,
        created_at=_now(),
    )
    write_json(_map_path(map_id, "draft"), digital_map.model_dump())
    return digital_map


def load_map(map_id: str, status: str | None = None) -> DigitalMap:
    candidates: list[Path] = []
    if status == "draft":
        candidates = [_map_path(map_id, "draft")]
    elif status == "verified":
        candidates = [_map_path(map_id, "verified")]
    else:
        candidates = [_map_path(map_id, "verified"), _map_path(map_id, "draft")]
    for path in candidates:
        if path.exists():
            return DigitalMap(**read_json(path))
    raise NotFoundError(f"Map not found: {map_id}")


def load_default_verified_map() -> DigitalMap:
    path = _map_path(DEFAULT_MAP_ID, "verified")
    if path.exists():
        return DigitalMap(**read_json(path))
    maps = sorted(VERIFIED_MAPS_DIR.glob("*.json"))
    if not maps:
        raise NotFoundError("No verified map available")
    return DigitalMap(**read_json(maps[0]))


def confirm_map(map_id: str) -> DigitalMap:
    """Promote a draft map into the verified patient-facing map directory."""
    draft = load_map(map_id, status="draft")
    verified = draft.model_copy(update={"status": "verified", "verified_at": _now()})
    write_json(_map_path(map_id, "verified"), verified.model_dump())
    return verified


def update_node_anchor(map_id: str, node_id: str, request: NodeAnchorUpdateRequest) -> DigitalMap:
    """Move a node anchor in the selected map and recompute local edge weights."""
    map_path = _map_path(map_id, request.status)
    digital_map = load_map(map_id, status=request.status)
    updated_nodes: list[MapNode] = []
    moved_node: MapNode | None = None
    for node in digital_map.nodes:
        if node.node_id == node_id:
            moved_node = node.model_copy(update={"x": request.x, "y": request.y})
            updated_nodes.append(moved_node)
        else:
            updated_nodes.append(node)
    if moved_node is None:
        raise NotFoundError(f"Node not found: {node_id}")

    updated_pois = [
        poi.model_copy(update={"x": request.x, "y": request.y})
        if poi.node_id == node_id
        else poi
        for poi in digital_map.pois
    ]

    node_lookup = {node.node_id: node for node in updated_nodes}
    updated_edges: list[MapEdge] = []
    for edge in digital_map.edges:
        from_node = node_lookup.get(edge.from_node)
        to_node = node_lookup.get(edge.to_node)
        if from_node is None or to_node is None:
            updated_edges.append(edge)
            continue
        if node_id in (edge.from_node, edge.to_node):
            weight = round(math.dist((from_node.x, from_node.y), (to_node.x, to_node.y)), 2)
            updated_edges.append(edge.model_copy(update={"weight": weight}))
        else:
            updated_edges.append(edge)

    updated_map = digital_map.model_copy(update={"nodes": updated_nodes, "edges": updated_edges, "pois": updated_pois})
    write_json(map_path, updated_map.model_dump())
    return updated_map


def list_maps() -> list[MapListItem]:
    items: dict[str, MapListItem] = {}
    for status, directory in (("draft", DRAFT_MAPS_DIR), ("verified", VERIFIED_MAPS_DIR)):
        directory.mkdir(parents=True, exist_ok=True)
        for path in directory.glob("*.json"):
            digital_map = DigitalMap(**read_json(path))
            items[digital_map.map_id] = MapListItem(
                map_id=digital_map.map_id,
                status=status,  # type: ignore[arg-type]
                version=digital_map.version,
                floor_count=len(digital_map.floors),
                node_count=len(digital_map.nodes),
                edge_count=len(digital_map.edges),
                poi_count=len(digital_map.pois),
                created_at=digital_map.created_at,
                verified_at=digital_map.verified_at,
            )
    return sorted(items.values(), key=lambda item: item.map_id)


def get_floor_image_path(map_id: str, floor_number: int) -> Path:
    digital_map = load_map(map_id)
    for floor in digital_map.floors:
        if floor.floor_number == floor_number:
            image_path = RAW_DIR / floor.source_image
            if not image_path.exists():
                raise NotFoundError(f"Floor image not found: {floor.source_image}")
            return image_path
    raise NotFoundError(f"Floor {floor_number} not found in map {map_id}")


def delete_map_files_for_test(map_id: str) -> None:
    """Test helper. Not used by production routes."""
    for path in (_map_path(map_id, "draft"), _map_path(map_id, "verified")):
        if path.exists():
            path.unlink()
