"use client";

import { useState } from "react";
import { confirmMap, digitizeMap, previewDraftRoute, previewRoute } from "@/lib/api";
import type { DigitalMap, RouteResult } from "@/lib/types";
import { Chip, EmptyState, Metric, Panel } from "@/components/ui";
import MapCanvas from "@/components/MapCanvas";

export default function MapBuilderPage() {
  const [digitalMap, setDigitalMap] = useState<DigitalMap | null>(null);
  const [mapFloor, setMapFloor] = useState(2);
  const [mapBusy, setMapBusy] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [routePreview, setRoutePreview] = useState<RouteResult | null>(null);
  const [routeStart, setRouteStart] = useState("loc_A203");
  const [routeDestination, setRouteDestination] = useState("loc_A303");
  const [showNodes, setShowNodes] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [showPois, setShowPois] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  async function runDigitizeMap() {
    setMapBusy(true);
    setMapError(null);
    setRoutePreview(null);
    try {
      const result = await digitizeMap();
      setDigitalMap(result);
      setMapFloor(result.floors[0]?.floor_number ?? 1);
    } catch (caught) {
      setMapError(caught instanceof Error ? caught.message : "Số hoá bản đồ thất bại");
    } finally {
      setMapBusy(false);
    }
  }

  async function runConfirmMap() {
    if (!digitalMap) return;
    setMapBusy(true);
    setMapError(null);
    try {
      setDigitalMap(await confirmMap(digitalMap.map_id));
    } catch (caught) {
      setMapError(caught instanceof Error ? caught.message : "Không xác nhận được bản đồ");
    } finally {
      setMapBusy(false);
    }
  }

  async function runPreviewRoute() {
    setMapBusy(true);
    setMapError(null);
    try {
      setRoutePreview(
        digitalMap?.status === "draft"
          ? await previewDraftRoute(digitalMap.map_id, routeStart, routeDestination)
          : await previewRoute(routeStart, routeDestination),
      );
    } catch (caught) {
      setMapError(caught instanceof Error ? caught.message : "Xem đường đi thất bại");
    } finally {
      setMapBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Dựng bản đồ</h2>
          <div className="sub">
            {digitalMap ? digitalMap.map_id : "bachmai_main_multifloor_v1"} · số hoá bản đồ → đồ thị đường đi
          </div>
        </div>
        <div className="topbar-right">
          <Chip variant={digitalMap?.status === "verified" ? "busy" : "neutral"}>
            {digitalMap ? (digitalMap.status === "verified" ? "Đã xác thực" : "Bản nháp") : "Chưa số hoá"}
          </Chip>
        </div>
      </div>

      <div className="content">
        <div className="grid-2" style={{ gridTemplateColumns: "360px 1fr" }}>
          <div className="stack">
            <Panel eyebrow="Bước 1" title="Số hoá và xác thực">
              <div className="btn-row" style={{ marginBottom: 14 }}>
                <button className="btn btn-secondary" onClick={runDigitizeMap} disabled={mapBusy}>
                  Số hoá ảnh PNG
                </button>
                <button
                  className="btn btn-success"
                  onClick={runConfirmMap}
                  disabled={mapBusy || !digitalMap || digitalMap.status === "verified"}
                >
                  Xác nhận bản đồ
                </button>
              </div>
              <div className="grid-2">
                <Metric label="Trạng thái" value={digitalMap?.status ?? "chưa số hoá"} small />
                <Metric label="Điểm POI" value={digitalMap ? String(digitalMap.pois.length) : "-"} />
                <Metric label="Nút" value={digitalMap ? String(digitalMap.nodes.length) : "-"} />
                <Metric label="Cạnh" value={digitalMap ? String(digitalMap.edges.length) : "-"} />
              </div>
            </Panel>

            <Panel eyebrow="Bước 2" title="Xem đường đi">
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Tầng</label>
                <select value={mapFloor} onChange={(event) => setMapFloor(Number(event.target.value))}>
                  {(digitalMap?.floors ?? [{ floor_number: 1 }, { floor_number: 2 }, { floor_number: 3 }]).map(
                    (floor) => (
                      <option key={floor.floor_number} value={floor.floor_number}>
                        Tầng {floor.floor_number}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="grid-2" style={{ marginBottom: 12 }}>
                <div className="field">
                  <label>Điểm bắt đầu</label>
                  <select value={routeStart} onChange={(event) => setRouteStart(event.target.value)}>
                    <option value="loc_A203">A203</option>
                    <option value="loc_A101">A101</option>
                    <option value="loc_A303">A303</option>
                  </select>
                </div>
                <div className="field">
                  <label>Điểm đến</label>
                  <select value={routeDestination} onChange={(event) => setRouteDestination(event.target.value)}>
                    <option value="loc_A303">A303</option>
                    <option value="loc_A311">A311</option>
                    <option value="loc_A124">A124</option>
                    <option value="loc_A203">A203</option>
                  </select>
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", marginBottom: 14 }}
                onClick={runPreviewRoute}
                disabled={mapBusy || !digitalMap || digitalMap.status !== "verified"}
              >
                Xem đường đi ngắn nhất
              </button>
              {routePreview?.instructions.length ? (
                <ol className="instr-list">
                  {routePreview.instructions.map((item) => (
                    <li key={item.step}>
                      <span className="n">{item.step}</span>
                      {item.text_vi}
                    </li>
                  ))}
                </ol>
              ) : null}
              {mapError ? <EmptyState text={mapError} /> : null}
            </Panel>
          </div>

          <MapCanvas
            digitalMap={digitalMap}
            floorNumber={mapFloor}
            routePreview={routePreview}
            routeStart={routeStart}
            routeDestination={routeDestination}
            showNodes={showNodes}
            showEdges={showEdges}
            showPois={showPois}
            showRoute={showRoute}
            setShowNodes={setShowNodes}
            setShowEdges={setShowEdges}
            setShowPois={setShowPois}
            setShowRoute={setShowRoute}
            setDigitalMap={setDigitalMap}
            setRoutePreview={setRoutePreview}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
          />
        </div>
      </div>
    </>
  );
}
