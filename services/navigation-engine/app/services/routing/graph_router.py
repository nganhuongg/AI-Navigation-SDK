"""Shortest-path routing over verified digital maps."""

from __future__ import annotations

import uuid

import networkx as nx

from app.core.errors import NotFoundError, ValidationError
from app.models.analytics import AnalyticsEventRequest
from app.models.map import DigitalMap, MapNode, MapStatus
from app.models.route import RouteInstruction, RouteRequest, RouteResult
from app.services.analytics.event_logger import log_event
from app.services.journey import state_manager
from app.services.locations import location_service
from app.services.map_digitization import digitizer


def _destination_from_session(session_id: str | None) -> str | None:
    if not session_id:
        return None
    session = state_manager.get_session(session_id)
    return session.next_action.target_location_id or session.next_action.target_room


def _node_by_location(digital_map: DigitalMap, location_id: str) -> MapNode:
    location = location_service.get_location(location_id)
    for poi in digital_map.pois:
        if poi.location_id == location.location_id or poi.poi_id == location.poi_id:
            for node in digital_map.nodes:
                if node.node_id == poi.node_id:
                    return node
    raise NotFoundError(f"Location is not linked to the verified map: {location_id}")


def _build_graph(digital_map: DigitalMap) -> nx.Graph:
    graph = nx.Graph()
    node_ids = {node.node_id for node in digital_map.nodes}
    for node in digital_map.nodes:
        graph.add_node(node.node_id)
    for edge in digital_map.edges:
        if edge.from_node in node_ids and edge.to_node in node_ids:
            graph.add_edge(edge.from_node, edge.to_node, weight=edge.weight, kind=edge.kind)
    return graph


def _route_on_map(digital_map: DigitalMap, request: RouteRequest) -> RouteResult:
    destination_id = request.destination_location_id or _destination_from_session(request.session_id)
    if not destination_id:
        raise ValidationError("destination_location_id is required when the session has no navigation target")

    if not request.start_location_id:
        raise ValidationError("start_location_id is required for map routing")

    start_location = location_service.get_location(request.start_location_id)
    destination_location = location_service.get_location(destination_id)
    start_node = _node_by_location(digital_map, start_location.location_id)
    destination_node = _node_by_location(digital_map, destination_location.location_id)

    graph = _build_graph(digital_map)
    try:
        node_path = nx.shortest_path(graph, start_node.node_id, destination_node.node_id, weight="weight")
        total_weight = nx.shortest_path_length(graph, start_node.node_id, destination_node.node_id, weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound) as exc:
        raise NotFoundError("No verified route found between these locations") from exc

    nodes_by_id = {node.node_id: node for node in digital_map.nodes}
    path_nodes = [nodes_by_id[node_id] for node_id in node_path]
    instructions = _instructions(path_nodes, start_location.poi_id, destination_location.poi_id)
    result = RouteResult(
        route_id="route_map_" + uuid.uuid4().hex[:12],
        start_location_id=start_location.location_id,
        destination_location_id=destination_location.location_id,
        start_room=start_location.poi_id,
        destination_room=destination_location.poi_id,
        map_available=True,
        instructions=instructions,
        estimated_seconds=max(30, round(float(total_weight) / 12)),
        node_path=node_path,
        polyline=[
            {"x": node.x, "y": node.y, "floor": float(node.floor_number)}
            for node in path_nodes
        ],
    )

    log_event(
        AnalyticsEventRequest(
            event_type="route_requested",
            session_id=request.session_id,
            metadata={
                "start_location_id": result.start_location_id or "",
                "destination_location_id": result.destination_location_id,
                "map_available": True,
                "map_id": digital_map.map_id,
                "map_status": digital_map.status,
            },
        )
    )
    return result


def get_route_for_map(map_id: str, request: RouteRequest, status: MapStatus = "verified") -> RouteResult:
    digital_map = digitizer.load_map(map_id, status=status)
    return _route_on_map(digital_map, request)


def _instructions(path_nodes: list[MapNode], start_room: str | None, destination_room: str) -> list[RouteInstruction]:
    if not path_nodes:
        return []

    instructions: list[str] = []
    first_floor = path_nodes[0].floor_number
    last_floor = path_nodes[-1].floor_number
    if start_room:
        instructions.append(f"Giai đoạn 1: bắt đầu từ {start_room} ở tầng {first_floor}.")
    else:
        instructions.append(f"Giai đoạn 1: bắt đầu từ vị trí hiện tại ở tầng {first_floor}.")

    current_floor = first_floor
    stage = 2
    for previous, current in zip(path_nodes, path_nodes[1:]):
        if previous.floor_number != current.floor_number:
            connector = "thang máy" if "elevator" in {previous.kind, current.kind} else "cầu thang"
            instructions.append(
                f"Giai đoạn {stage}: đến {connector}, đi từ tầng {previous.floor_number} lên tầng {current.floor_number}."
            )
            stage += 1
            current_floor = current.floor_number

    if first_floor == last_floor:
        instructions.append(f"Giai đoạn {stage}: đi theo đường màu xanh đến phòng {destination_room}.")
    else:
        instructions.append(f"Giai đoạn {stage}: ra khỏi khu thang, đi theo đường màu xanh đến phòng {destination_room} ở tầng {last_floor}.")
    instructions.append("Nếu không thấy biển phòng, bác hỏi nhân viên trực gần nhất.")

    return [
        RouteInstruction(step=index + 1, text=text, text_vi=text)
        for index, text in enumerate(instructions)
    ]


def get_route(request: RouteRequest) -> RouteResult:
    digital_map = digitizer.load_default_verified_map()
    return _route_on_map(digital_map, request)
