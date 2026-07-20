import type {
  ApiResponse,
  ChatbotMessageResponse,
  ChatbotMetadata,
  CareJourneyTemplate,
  CareJourneyTemplateSummary,
  DigitalMap,
  HealthStatus,
  MapStatus,
  MapListItem,
  OCRResult,
  RouteResult,
  SessionContext,
  STTResponse,
  TTSResponse,
} from "@/lib/types";

const CONFIGURED_ENGINE_BASE_URL =
  process.env.NEXT_PUBLIC_ENGINE_BASE_URL || "http://localhost:8001";

/** Resolve the engine URL, swapping localhost<->127.0.0.1 to match how the
 * browser opened this app (avoids a cross-host CORS/cookie mismatch). */
export function getEngineBaseUrl(): string {
  if (typeof window === "undefined") return CONFIGURED_ENGINE_BASE_URL;
  try {
    const configured = new URL(CONFIGURED_ENGINE_BASE_URL);
    if (window.location.hostname === "127.0.0.1" && configured.hostname === "localhost") {
      configured.hostname = "127.0.0.1";
    }
    return configured.toString().replace(/\/$/, "");
  } catch {
    return CONFIGURED_ENGINE_BASE_URL;
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success || body.data === null) {
    throw new Error(body.error || `Request failed with ${response.status}`);
  }
  return body.data;
}

export async function getHealth(): Promise<HealthStatus> {
  const response = await fetch(`${getEngineBaseUrl()}/health`);
  return unwrap<HealthStatus>(response);
}

export async function startSession(): Promise<SessionContext> {
  const response = await fetch(`${getEngineBaseUrl()}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_id: "standard_outpatient_v1" }),
  });
  return unwrap<SessionContext>(response);
}

export async function listJourneyTemplates(): Promise<CareJourneyTemplateSummary[]> {
  const response = await fetch(`${getEngineBaseUrl()}/journey-templates`);
  return unwrap<CareJourneyTemplateSummary[]>(response);
}

export async function getJourneyTemplate(templateId: string): Promise<CareJourneyTemplate> {
  const response = await fetch(`${getEngineBaseUrl()}/journey-templates/${encodeURIComponent(templateId)}`);
  return unwrap<CareJourneyTemplate>(response);
}

export async function updateJourneyTemplate(
  templateId: string,
  template: CareJourneyTemplate,
): Promise<CareJourneyTemplate> {
  const response = await fetch(`${getEngineBaseUrl()}/journey-templates/${encodeURIComponent(templateId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(template),
  });
  return unwrap<CareJourneyTemplate>(response);
}

export async function extractOcr(file: File): Promise<OCRResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${getEngineBaseUrl()}/ocr/extract`, {
    method: "POST",
    body: form,
  });
  return unwrap<OCRResult>(response);
}

export async function confirmOcr(
  sessionId: string,
  result: OCRResult,
  markInitialStepsDone: boolean,
): Promise<SessionContext> {
  const response = await fetch(`${getEngineBaseUrl()}/session/${sessionId}/confirm-ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        ...result.fields,
        completed_steps: markInitialStepsDone ? ["register", "identity", "payment"] : [],
      },
      confidence: result.confidence,
    }),
  });
  return unwrap<SessionContext>(response);
}

export async function transcribeAudio(audio: Blob): Promise<STTResponse> {
  const form = new FormData();
  form.append("file", audio, "admin-test.wav");
  let response: Response;
  try {
    response = await fetch(`${getEngineBaseUrl()}/stt`, { method: "POST", body: form });
  } catch {
    throw new Error(`Không kết nối được STT tại ${getEngineBaseUrl()}. Kiểm tra Navigation Engine đang chạy trên cổng 8001.`);
  }
  return unwrap<STTResponse>(response);
}

export async function synthesizeSpeech(text: string, voice: string): Promise<TTSResponse> {
  const response = await fetch(`${getEngineBaseUrl()}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  return unwrap<TTSResponse>(response);
}

export async function sendChatMessage(
  text: string,
  sessionId: string,
  metadata: ChatbotMetadata = {},
): Promise<ChatbotMessageResponse> {
  const response = await fetch(`${getEngineBaseUrl()}/api/chatbot/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      sender_id: sessionId,
      text,
      metadata,
    }),
  });
  return unwrap<ChatbotMessageResponse>(response);
}

export async function listMaps(): Promise<MapListItem[]> {
  const response = await fetch(`${getEngineBaseUrl()}/maps`);
  return unwrap<MapListItem[]>(response);
}

export async function digitizeMap(): Promise<DigitalMap> {
  const response = await fetch(`${getEngineBaseUrl()}/maps/digitize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ map_id: "bachmai_main_multifloor_v1", floor_numbers: [1, 2, 3] }),
  });
  return unwrap<DigitalMap>(response);
}

export async function confirmMap(mapId: string): Promise<DigitalMap> {
  const response = await fetch(`${getEngineBaseUrl()}/maps/${mapId}/confirm`, { method: "POST" });
  return unwrap<DigitalMap>(response);
}

export async function previewRoute(start: string, destination: string): Promise<RouteResult> {
  const response = await fetch(`${getEngineBaseUrl()}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: "admin_map_preview",
      start_location_id: start,
      destination_location_id: destination,
    }),
  });
  return unwrap<RouteResult>(response);
}

export async function previewDraftRoute(
  mapId: string,
  start: string,
  destination: string,
): Promise<RouteResult> {
  const response = await fetch(`${getEngineBaseUrl()}/maps/${mapId}/route-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: "admin_map_preview",
      start_location_id: start,
      destination_location_id: destination,
      map_status: "draft",
    }),
  });
  return unwrap<RouteResult>(response);
}

export async function updateNodeAnchor(
  mapId: string,
  nodeId: string,
  x: number,
  y: number,
  status: MapStatus,
): Promise<DigitalMap> {
  const response = await fetch(`${getEngineBaseUrl()}/maps/${mapId}/nodes/${nodeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x, y, status }),
  });
  return unwrap<DigitalMap>(response);
}
