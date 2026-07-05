"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ReadAloudButton from "@/components/ReadAloudButton";
import SDKGate from "@/components/SDKGate";
import { useDemo } from "@/context/demo";
import { getEngineBaseUrl, markArrived } from "@/lib/api";
import SmartUXEvents from "@/integrations/smartux/smartuxEvents";

type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

type MapFloor = {
  floor_number: number;
  image_width: number;
  image_height: number;
};

type DigitalMap = {
  map_id: string;
  status: "draft" | "verified";
  floors: MapFloor[];
};

type RoutePoint = {
  x: number;
  y: number;
  floor?: number;
};

type RouteResult = {
  start_room?: string;
  destination_room: string;
  map_available: boolean;
  polyline: RoutePoint[];
  instructions: Array<{ step: number; text_vi: string }>;
  estimated_seconds: number;
};

type RouteSegment = {
  floor: number;
  points: RoutePoint[];
  title: string;
  subtitle: string;
};

const MAP_ID = "bachmai_main_multifloor_v1";

const DESTINATIONS = [
  { locationId: "loc_A101", label: "A101", detail: "Quầy hướng dẫn - tầng 1" },
  { locationId: "loc_A203", label: "A203", detail: "Phòng khám ban đầu - tầng 2" },
  { locationId: "loc_A303", label: "A303", detail: "Phòng lấy máu 1 - tầng 3" },
  { locationId: "loc_A311", label: "A311", detail: "Siêu âm - tầng 3" },
  { locationId: "loc_A124", label: "A124", detail: "Nhà thuốc - tầng 1" },
];

async function readApi<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success || body.data === null) {
    throw new Error(body.error || `Request failed with ${response.status}`);
  }
  return body.data;
}

async function loadVerifiedMap(): Promise<DigitalMap> {
  const response = await fetch(`${getEngineBaseUrl()}/maps/${MAP_ID}/verified`);
  return readApi<DigitalMap>(response);
}

async function getRoute(destination: string, sessionId: string | null, startLocationId: string): Promise<RouteResult> {
  const response = await fetch(`${getEngineBaseUrl()}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId || "patient_navigation_demo",
      start_location_id: startLocationId,
      destination_location_id: destination,
    }),
  });
  return readApi<RouteResult>(response);
}

export default function NavigatePage() {
  return (
    <SDKGate title="Chỉ đường trong bệnh viện" backHref="/assistant">
      <NavigateWorkspace />
    </SDKGate>
  );
}

function NavigateWorkspace() {
  const { session, setSession } = useDemo();
  const searchParams = useSearchParams();
  const requestedDestination = searchParams.get("destination");
  const [digitalMap, setDigitalMap] = useState<DigitalMap | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [destination, setDestination] = useState(
    requestedDestination || session?.next_action.target_location_id || "loc_A203",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [arriving, setArriving] = useState(false);
  const [routeCompleted, setRouteCompleted] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  const startLocationId = useMemo(() => resolveStartLocation(session), [session]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const map = await loadVerifiedMap();
        const nextRoute = await getRoute(destination, session?.session_id || null, startLocationId);
        if (!ignore) {
          setDigitalMap(map);
          setRoute(nextRoute);
          setCurrentStageIndex(0);
        }
      } catch (caught) {
        if (!ignore) {
          setError(caught instanceof Error ? caught.message : "Không tải được bản đồ.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [destination, session?.session_id, startLocationId]);

  useEffect(() => {
    if (requestedDestination) {
      setDestination(requestedDestination);
    }
  }, [requestedDestination]);

  useEffect(() => {
    if (!requestedDestination && session?.next_action.target_location_id) {
      setDestination(session.next_action.target_location_id);
    }
  }, [requestedDestination, session?.next_action.target_location_id]);

  const currentDestination = useMemo(
    () =>
      DESTINATIONS.find((item) => item.locationId === destination) ?? {
        locationId: destination,
        label: destination.replace(/^loc_/, ""),
        detail: "Điểm đến trong bệnh viện",
      },
    [destination],
  );
  const segments = useMemo(() => splitRouteByFloor(route?.polyline ?? [], digitalMap?.floors ?? []), [route, digitalMap]);
  const stageCount = Math.max(segments.length, route?.instructions.length ?? 0);
  const activeSegment = pickSegmentForStage(segments, currentStageIndex, stageCount);
  const activeSegmentIndex = activeSegment ? segments.indexOf(activeSegment) : -1;
  const activeInstruction = route?.instructions[currentStageIndex] ?? route?.instructions[0] ?? null;
  const activeInstructionSpeech = activeInstruction
    ? `Chặng ${currentStageIndex + 1} trong ${Math.max(1, stageCount)}. ${activeInstruction.text_vi}`
    : "";
  const isLastStage = stageCount <= 1 || currentStageIndex >= stageCount - 1;
  const estimatedMinutes = Math.max(1, Math.round((route?.estimated_seconds ?? 60) / 60));
  useEffect(() => {
    SmartUXEvents.screenView("Navigate", {
      session_id: session?.session_id || "anonymous_session",
    });
  }, [session?.session_id]);

  useEffect(() => {
    SmartUXEvents.routeRequested(startLocationId, destination, {
      session_id: session?.session_id || "anonymous_session",
      accessibility_mode: "standard",
    });
  }, [destination, session?.session_id, startLocationId]);

  async function confirmArrivalOnMap() {
    if (!session) {
      setStatusMessage(`Đã ghi nhận bác tới ${currentDestination.label}.`);
      setRouteCompleted(true);
      return;
    }

    setArriving(true);
    setStatusMessage("Đang cập nhật trạng thái đã đến nơi...");
    try {
      const updated = await markArrived(session.session_id);
      setSession(updated);
      setCurrentStageIndex(0);
      SmartUXEvents.stepCompleted("route_confirmation", {
        room_id: currentDestination.label,
        session_id: session.session_id,
      });
      if (updated.next_action.type === "done") {
        setStatusMessage("Chúc mừng bác, hành trình khám hôm nay đã hoàn thành.");
        setRouteCompleted(true);
        SmartUXEvents.sessionEnded("completed", {
          session_id: session.session_id,
        });
        return;
      }
      if (updated.next_action.target_location_id) {
        setDestination(updated.next_action.target_location_id);
        setRouteCompleted(true);
      }
      setStatusMessage(`Đã cập nhật hành trình. Bước tiếp theo: ${updated.next_action.message}`);
    } catch (caught) {
      SmartUXEvents.fallbackTriggered("route_confirmation_failed", {
        session_id: session?.session_id || "anonymous_session",
      });
      SmartUXEvents.exception(caught, {
        feature: "navigate",
        session_id: session?.session_id || "anonymous_session",
      });
      setStatusMessage(caught instanceof Error ? caught.message : "Chưa thể cập nhật trạng thái đến nơi.");
    } finally {
      setArriving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader title="Chỉ đường trong bệnh viện" backHref="/assistant" />

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Điểm đến</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-black text-slate-900">{currentDestination.label}</h1>
              <p className="text-xs text-slate-500">{currentDestination.detail}</p>
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#008751]">
              Khoảng {estimatedMinutes} phút
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {DESTINATIONS.map((item) => (
              <button
                key={item.locationId}
                onClick={() => {
                  setRouteCompleted(false);
                  setStatusMessage(null);
                  setDestination(item.locationId);
                }}
                className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                  item.locationId === destination
                    ? "border-[#008751] bg-emerald-50 text-[#008751]"
                    : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                <div className="font-black">{item.label}</div>
                <div className="mt-0.5 leading-snug">{item.detail}</div>
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {statusMessage ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-[#006b3e]">
            {statusMessage}
            {routeCompleted ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href="/assistant?screen=checklist"
                  className="flex h-11 items-center justify-center rounded-xl bg-[#008751] px-3 text-center text-xs font-black text-white"
                >
                  Xem hành trình
                </Link>
                <Link
                  href="/assistant"
                  className="flex h-11 items-center justify-center rounded-xl border-2 border-emerald-200 bg-white px-3 text-center text-xs font-black text-[#006b3e]"
                >
                  Về trợ lý
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-slate-800">Bản đồ thật của bệnh viện</p>
              <p className="text-[11px] text-slate-400">
                Mỗi thẻ hiển thị toàn bộ bản đồ tầng và kẻ tuyến đường ngắn nhất cần đi.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
              {loading ? "Đang tải..." : `${segments.length} đoạn`}
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {activeSegment ? (
              (() => {
                const floor = digitalMap?.floors.find((item) => item.floor_number === activeSegment.floor);
                if (!digitalMap || !floor) return null;
                const imageUrl = `${getEngineBaseUrl()}/maps/${digitalMap.map_id}/floor/${activeSegment.floor}/image`;
                return (
                  <FloorRouteCard
                    key={`${activeSegment.floor}-${currentStageIndex}-${activeSegmentIndex}`}
                    title={activeSegment.title}
                    subtitle={activeSegment.subtitle}
                    floorNumber={activeSegment.floor}
                    floor={floor}
                    imageUrl={imageUrl}
                    points={activeSegment.points}
                    startLabel={currentStageIndex === 0 ? "Vị trí hiện tại" : "Thang máy / cầu thang"}
                    endLabel={activeSegmentIndex === segments.length - 1 ? currentDestination.label : "Điểm trung chuyển"}
                  />
                );
              })()
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Chưa có tuyến đường để hiển thị.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-black text-slate-800">Hướng dẫn từng chặng</p>
          {activeInstruction ? (
            <div className="mt-3 space-y-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#008751] text-sm font-black text-white">
                    {currentStageIndex + 1}
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      Chặng {currentStageIndex + 1}/{Math.max(1, stageCount)}
                    </p>
                    <div className="mt-2">
                      <ReadAloudButton
                        text={activeInstructionSpeech}
                        label={`chặng ${currentStageIndex + 1}`}
                        inlineLabel
                        className="min-h-9 px-3"
                      />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{activeInstruction.text_vi}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStageIndex((value) => Math.max(0, value - 1))}
                  disabled={currentStageIndex === 0}
                  className="h-12 flex-1 rounded-2xl border-2 border-slate-200 bg-white text-sm font-black text-slate-600 disabled:opacity-40"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isLastStage) {
                      void confirmArrivalOnMap();
                      return;
                    }
                    setCurrentStageIndex((value) => Math.min(Math.max(1, stageCount) - 1, value + 1));
                  }}
                  disabled={arriving}
                  className="h-12 flex-1 rounded-2xl bg-[#008751] text-sm font-black text-white disabled:bg-slate-300"
                >
                  {isLastStage ? (arriving ? "Đang cập nhật..." : "Xác nhận đã đến nơi") : "Tôi đã xong chặng này"}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              {loading ? "Đang tính đường..." : "Chưa có hướng dẫn."}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-[#008751]">Luồng sau SDK</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-700">
            Nếu bác đang ở phòng khám ban đầu, tuyến sẽ bắt đầu từ quầy đăng ký rồi dẫn tới phòng khám ban đầu;
            còn khi có chỉ định cận lâm sàng, màn này sẽ cắt đúng đoạn từ vị trí hiện tại đến thang máy,
            rồi từ thang máy đến điểm đến.
          </p>
        </div>
      </main>
    </div>
  );
}

function FloorRouteCard({
  title,
  subtitle,
  floorNumber,
  floor,
  imageUrl,
  points,
  startLabel,
  endLabel,
}: {
  title: string;
  subtitle: string;
  floorNumber: number;
  floor: MapFloor;
  imageUrl: string;
  points: RoutePoint[];
  startLabel: string;
  endLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-[#008751]">{title}</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{subtitle}</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
          Tầng {floorNumber}
        </div>
      </div>

      <div className="bg-slate-50 p-3">
        <svg
          viewBox={`0 0 ${floor.image_width} ${floor.image_height}`}
          className="block h-[460px] max-h-[62vh] min-h-[380px] w-full rounded-xl bg-white shadow-inner"
          preserveAspectRatio="xMidYMid meet"
        >
          <image
            href={imageUrl}
            x={0}
            y={0}
            width={floor.image_width}
            height={floor.image_height}
            preserveAspectRatio="none"
          />
          {points.length > 1 ? (
            <>
              <polyline
                points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="#16a34a"
                strokeWidth={18}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.28}
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="#008751"
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : null}
          {points[0] ? <RouteMarker point={points[0]} color="#2563eb" label={startLabel} /> : null}
          {points[points.length - 1] ? <RouteMarker point={points[points.length - 1]} color="#ef4444" label={endLabel} end /> : null}
        </svg>
      </div>
    </div>
  );
}

function RouteMarker({
  point,
  color,
  label,
  end = false,
}: {
  point: RoutePoint;
  color: string;
  label: string;
  end?: boolean;
}) {
  return (
    <g transform={`translate(${point.x}, ${point.y})`}>
      <circle r={15} fill={color} fillOpacity={0.18} />
      {end ? (
        <path
          d="M 0,-15 C -6,-15 -10,-10 -10,0 C -10,10 0,20 0,20 C 0,20 10,10 10,0 C 10,-10 6,-15 0,-15 Z"
          fill={color}
          stroke="#ffffff"
          strokeWidth={1.5}
        />
      ) : (
        <circle r={8} fill={color} stroke="#fff" strokeWidth={2.5} />
      )}
      <rect x={-38} y={-34} width={76} height={18} rx={5} fill="#111827" opacity={0.92} />
      <text x={0} y={-21} textAnchor="middle" fill="#ffffff" fontSize={8} fontWeight={700}>
        {label}
      </text>
    </g>
  );
}

function splitRouteByFloor(polyline: RoutePoint[], floors: MapFloor[]): RouteSegment[] {
  const normalized = dedupePolyline(polyline);
  const groups = new Map<number, RoutePoint[]>();
  for (const point of normalized) {
    const floorNumber = Math.round(Number(point.floor ?? floors[0]?.floor_number ?? 1));
    const list = groups.get(floorNumber) ?? [];
    list.push({ ...point, floor: floorNumber });
    groups.set(floorNumber, list);
  }

  const orderedFloors = [...groups.keys()].sort((a, b) => a - b);
  return orderedFloors.map((floor, index) => ({
    floor,
    points: groups.get(floor) ?? [],
    title: index === 0 ? "Đoạn 1" : index === orderedFloors.length - 1 ? "Đoạn cuối" : `Đoạn ${index + 1}`,
    subtitle:
      index === 0
        ? "Từ vị trí hiện tại tới thang máy hoặc cầu thang"
        : index === orderedFloors.length - 1
          ? "Từ thang máy hoặc cầu thang tới điểm đến"
          : "Đoạn chuyển tầng trung gian",
  }));
}

function pickSegmentForStage(segments: RouteSegment[], stageIndex: number, stageCount: number) {
  if (segments.length === 0) return null;
  if (segments.length === 1 || stageCount <= 1) return segments[0];
  const boundedStage = Math.min(Math.max(stageIndex, 0), stageCount - 1);
  const segmentIndex = Math.min(segments.length - 1, Math.floor((boundedStage * segments.length) / stageCount));
  return segments[segmentIndex];
}

function dedupePolyline(points: RoutePoint[]) {
  const result: RoutePoint[] = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (last && last.x === point.x && last.y === point.y && Number(last.floor ?? -1) === Number(point.floor ?? -1)) {
      continue;
    }
    result.push(point);
  }
  return result;
}

function resolveStartLocation(session: ReturnType<typeof useDemo>["session"]) {
  if (!session) return "loc_A101";
  if (session.current_location) return session.current_location;
  if (session.journey.current_step === "waiting_for_doctor") {
    return `loc_${session.journey.register.location_code}`;
  }
  const services = session.journey.specialized_process?.services ?? [];
  const activeIndex = services.findIndex((service) => service.status !== "completed");
  if (activeIndex > 0) {
    return `loc_${services[activeIndex - 1].room}`;
  }
  if (activeIndex === 0) {
    const initialExamRoom =
      session.journey.extracted_fields.initial_exam_room ||
      session.journey.extracted_fields.return_room ||
      "A203";
    if (services[activeIndex].room !== initialExamRoom) {
      return `loc_${initialExamRoom}`;
    }
    return `loc_${session.journey.payment.location_code || session.journey.register.location_code}`;
  }
  return `loc_${session.journey.register.location_code}`;
}
