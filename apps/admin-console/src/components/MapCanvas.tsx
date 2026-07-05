"use client";

import { useEffect, useRef, useState } from "react";
import { getEngineBaseUrl, previewDraftRoute, previewRoute, updateNodeAnchor } from "@/lib/api";
import type { DigitalMap, MapEdge, MapNode, RouteResult } from "@/lib/types";
import { EmptyState } from "@/components/ui";

export default function MapCanvas({
  digitalMap,
  floorNumber,
  routePreview,
  routeStart,
  routeDestination,
  showNodes,
  showEdges,
  showPois,
  showRoute,
  setShowNodes,
  setShowEdges,
  setShowPois,
  setShowRoute,
  setDigitalMap,
  setRoutePreview,
  selectedNodeId,
  setSelectedNodeId,
}: {
  digitalMap: DigitalMap | null;
  floorNumber: number;
  routePreview: RouteResult | null;
  routeStart: string;
  routeDestination: string;
  showNodes: boolean;
  showEdges: boolean;
  showPois: boolean;
  showRoute: boolean;
  setShowNodes: React.Dispatch<React.SetStateAction<boolean>>;
  setShowEdges: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPois: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRoute: React.Dispatch<React.SetStateAction<boolean>>;
  setDigitalMap: React.Dispatch<React.SetStateAction<DigitalMap | null>>;
  setRoutePreview: React.Dispatch<React.SetStateAction<RouteResult | null>>;
  selectedNodeId: string | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const [draftMap, setDraftMapLocal] = useState<DigitalMap | null>(digitalMap);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    setDraftMapLocal(digitalMap);
    setSelectedNodeId(null);
    dragStateRef.current = null;
  }, [digitalMap, setSelectedNodeId]);

  if (!digitalMap) {
    return <EmptyState text="Bấm Số hoá ảnh PNG để tạo đồ thị nháp từ data/raw/map-floor*.png." />;
  }

  const mapForRender = draftMap ?? digitalMap;
  const floor = mapForRender.floors.find((item) => item.floor_number === floorNumber);
  if (!floor) return <EmptyState text="Tầng này chưa có trong bản đồ." />;
  const floorWidth = floor.image_width;
  const floorHeight = floor.image_height;

  const nodes = mapForRender.nodes.filter((node) => node.floor_number === floorNumber);
  const nodeById = new Map(nodes.map((node) => [node.node_id, node]));
  const edges = mapForRender.edges
    .map((edge) => ({ edge, from: nodeById.get(edge.from_node), to: nodeById.get(edge.to_node) }))
    .filter((item): item is { edge: MapEdge; from: MapNode; to: MapNode } => Boolean(item.from && item.to));
  const pois = mapForRender.pois.filter((poi) => poi.floor_number === floorNumber);
  const routePoints = routePreview?.polyline.filter((point) => Number(point.floor) === floorNumber) ?? [];
  const routePath = routePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const routeNodes = (routePreview?.node_path ?? [])
    .map((nodeId) => mapForRender.nodes.find((node) => node.node_id === nodeId))
    .filter((node): node is MapNode => Boolean(node && node.floor_number === floorNumber));
  const selectedNode = nodes.find((node) => node.node_id === selectedNodeId) ?? null;

  function getSvgPoint(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * floorWidth,
      y: ((event.clientY - rect.top) / rect.height) * floorHeight,
    };
  }

  function applyLocalMove(map: DigitalMap, nodeId: string, x: number, y: number): DigitalMap {
    return {
      ...map,
      nodes: map.nodes.map((node) => (node.node_id === nodeId ? { ...node, x, y } : node)),
      pois: map.pois.map((poi) => (poi.node_id === nodeId ? { ...poi, x, y } : poi)),
    };
  }

  async function commitNodeMove(nodeId: string, x: number, y: number) {
    try {
      const updated = await updateNodeAnchor(mapForRender.map_id, nodeId, x, y, mapForRender.status);
      setDraftMapLocal(updated);
      setDigitalMap(updated);
      if (routeStart && routeDestination) {
        setRoutePreview(
          updated.status === "draft"
            ? await previewDraftRoute(updated.map_id, routeStart, routeDestination)
            : await previewRoute(routeStart, routeDestination),
        );
      }
    } catch (caught) {
      setSelectedNodeId(nodeId);
      console.error(caught);
    }
  }

  function handleNodePointerDown(node: MapNode, event: React.MouseEvent<SVGCircleElement>) {
    if (mapForRender.status !== "draft") return;
    event.preventDefault();
    event.stopPropagation();
    const point = getSvgPoint(event as unknown as React.MouseEvent<SVGSVGElement>);
    if (!point) return;
    dragStateRef.current = { nodeId: node.node_id, offsetX: point.x - node.x, offsetY: point.y - node.y };
    setSelectedNodeId(node.node_id);
  }

  function handleSvgMove(event: React.MouseEvent<SVGSVGElement>) {
    const drag = dragStateRef.current;
    if (!drag || mapForRender.status !== "draft") return;
    const point = getSvgPoint(event);
    if (!point) return;
    const x = Math.max(0, Math.min(floorWidth, point.x - drag.offsetX));
    const y = Math.max(0, Math.min(floorHeight, point.y - drag.offsetY));
    setDraftMapLocal((current) => (current ? applyLocalMove(current, drag.nodeId, x, y) : current));
  }

  function handleSvgUp() {
    const drag = dragStateRef.current;
    if (!drag || mapForRender.status !== "draft") return;
    dragStateRef.current = null;
    const node =
      draftMap?.nodes.find((item) => item.node_id === drag.nodeId) ??
      mapForRender.nodes.find((item) => item.node_id === drag.nodeId);
    if (!node) return;
    void commitNodeMove(node.node_id, node.x, node.y);
  }

  return (
    <div className="map-canvas">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700 }}>{digitalMap.map_id}</p>
          <p style={{ fontSize: 11.5, color: "var(--muted)" }}>
            Tầng {floorNumber} · {floorWidth}×{floorHeight}
          </p>
        </div>
      </div>
      <div style={{ padding: "12px 16px 0" }}>
        <div className="layer-toggle">
          <button className={showEdges ? "on" : ""} onClick={() => setShowEdges((value) => !value)}>Cạnh</button>
          <button className={showNodes ? "on" : ""} onClick={() => setShowNodes((value) => !value)}>Nút</button>
          <button className={showPois ? "on" : ""} onClick={() => setShowPois((value) => !value)}>POI</button>
          <button className={showRoute ? "on" : ""} onClick={() => setShowRoute((value) => !value)}>Lộ trình</button>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <img
          src={`${getEngineBaseUrl()}/maps/${digitalMap.map_id}/floor/${floorNumber}/image`}
          alt={`Ảnh gốc tầng ${floorNumber}`}
          style={{ display: "block", width: "100%" }}
        />
        <svg
          viewBox={`0 0 ${floorWidth} ${floorHeight}`}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          ref={svgRef}
          onMouseMove={handleSvgMove}
          onMouseUp={handleSvgUp}
          onMouseLeave={handleSvgUp}
        >
          {showEdges
            ? edges.map(({ edge, from, to }) => (
                <line
                  key={edge.edge_id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={edge.kind === "door" ? "#94A3B8" : "#2563EB"}
                  strokeWidth={edge.kind === "door" ? 2 : 3}
                  strokeOpacity={edge.kind === "door" ? 0.45 : 0.28}
                />
              ))
            : null}
          {showRoute && routePath ? (
            <polyline points={routePath} fill="none" stroke="#DC2626" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {showNodes
            ? nodes.map((node) => {
                const isSelected = node.node_id === selectedNodeId;
                return (
                  <g key={node.node_id}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.kind === "room" ? 8 : 6}
                      fill={node.kind === "room" ? "#059669" : node.kind === "elevator" ? "#7C3AED" : "#0F172A"}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      onMouseDown={(event) => handleNodePointerDown(node, event)}
                      style={mapForRender.status === "draft" ? { cursor: "grab" } : undefined}
                    />
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.kind === "room" ? 14 : 12}
                      fill="none"
                      stroke={isSelected ? "#F59E0B" : node.kind === "room" ? "#059669" : node.kind === "elevator" ? "#7C3AED" : "#334155"}
                      strokeOpacity={isSelected ? 0.95 : 0.35}
                      strokeWidth={1.5}
                    />
                    {node.kind !== "corridor" ? (
                      <text x={node.x + 10} y={node.y - 10} fontSize={10} fontWeight={700} fill="#111827">
                        {node.label ?? node.node_id}
                      </text>
                    ) : null}
                  </g>
                );
              })
            : null}
          {showPois
            ? pois.slice(0, 24).map((poi) => (
                <g key={poi.poi_id}>
                  <rect x={poi.x + 6} y={poi.y - 10} width={42} height={16} rx={3} fill="white" fillOpacity={0.92} />
                  <text x={poi.x + 10} y={poi.y + 2} fontSize={10} fontWeight={700} fill="#0F172A">
                    {poi.poi_id}
                  </text>
                </g>
              ))
            : null}
        </svg>
      </div>

      {routePreview ? (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", fontSize: 11.5, color: "var(--muted)" }}>
          <div style={{ marginBottom: 8, fontWeight: 700, color: "var(--ink)" }}>Chuỗi nút trên đường ngắn nhất</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {routeNodes.map((node) => (
              <span key={node.node_id} className="chip chip-neutral">
                {node.node_id}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {selectedNode ? (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", fontSize: 11.5, color: "var(--muted)" }}>
          <div style={{ marginBottom: 4, fontWeight: 700, color: "var(--ink)" }}>Nút đang chọn</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <span>{selectedNode.node_id}</span>
            <span>{selectedNode.kind}</span>
            <span>x={selectedNode.x.toFixed(1)}</span>
            <span>y={selectedNode.y.toFixed(1)}</span>
            <span>{mapForRender.status === "draft" ? "kéo để căn chỉnh" : "đã khoá (verified)"}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
