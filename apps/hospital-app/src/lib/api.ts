type APIResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

export type VoicePreprocessInfo = {
  enabled: boolean;
  vad_applied: boolean;
  denoise_applied: boolean;
  input_sample_rate: number | null;
  output_sample_rate: number | null;
  input_duration_ms: number | null;
  output_duration_ms: number | null;
  speech_segments: number;
  engines: string[];
  note: string;
};

export type STTTimingInfo = {
  request_read_ms: number | null;
  preprocessing_ms: number;
  adapter_ms: number;
  total_ms: number;
};

export type STTResponse = {
  text: string;
  confidence: number;
  preprocess: VoicePreprocessInfo;
  timing: STTTimingInfo;
};

export type AssistantResponse = {
  intent: string;
  response_text: string;
  confidence: number;
  is_fallback: boolean;
  target_location_id: string | null;
  target_room: string | null;
};

export type ChatbotMetadata = {
  current_step?: string | null;
  target_room?: string | null;
  target_floor?: string | null;
  next_action?: string | null;
  accessibility_mode?: string | null;
};

export type ChatbotSessionContext = {
  session_id?: string | null;
  sender_id?: string | null;
  metadata?: ChatbotMetadata;
};

export type SmartBotCard = {
  type?: string;
  text?: string;
  title?: string;
  description?: string;
  content?: string;
  buttons?: Array<Record<string, unknown>>;
  audio_url?: string;
  play_type?: string;
  [key: string]: unknown;
};

export type ChatbotMessageResponse = {
  reply_text: string;
  cards: SmartBotCard[];
  intent_name: string | null;
  handoff_required: boolean;
};

export type OcrFields = {
  initial_exam_room?: string | null;
  ordered_services: string[];
  return_room?: string | null;
  detected_room_codes: string[];
  room_descriptions: Record<string, string>;
  room_notes: Record<string, string>;
  room_queue_numbers: Record<string, string>;
  specialty?: string | null;
  queue_number?: string | number | null;
  completed_steps?: string[];
};

export type OcrResult = {
  ocr_result_id: string;
  source_image: string;
  confidence: number;
  fields: OcrFields;
  requires_user_confirmation: boolean;
  is_low_confidence: boolean;
};

export type JourneyCheckpoint = {
  room: string;
  location_code: string;
  floor: number;
  is_done: boolean;
  completed_at?: string | null;
};

export type SpecializedService = {
  service_id: string;
  service_name: string;
  description: string;
  department: string;
  room: string;
  room_name: string;
  building: string;
  floor: number;
  estimated_duration_minutes: number;
  status: "pending" | "in_progress" | "completed" | "skipped";
  completed_at?: string | null;
  next_step?: string | null;
};

export type PatientJourney = {
  register: JourneyCheckpoint;
  identity: JourneyCheckpoint;
  payment: JourneyCheckpoint;
  specialized_process_updated: boolean;
  specialized_process?: {
    services: SpecializedService[];
    return_room?: string | null;
  } | null;
  extracted_fields: OcrFields;
  current_step: string;
  confidence_score?: number | null;
  requires_user_confirmation: boolean;
};

export type PatientSession = {
  session_id: string;
  template_id: string;
  created_at: string;
  expires_at: string;
  current_location?: string | null;
  journey: PatientJourney;
  next_action: {
    type: "navigate" | "scan" | "confirm" | "wait" | "done";
    target_location_id?: string | null;
    target_room?: string | null;
    message: string;
  };
};

const CONFIGURED_ENGINE_BASE_URL =
  process.env.NEXT_PUBLIC_ENGINE_BASE_URL || "http://localhost:8001";

export function getEngineBaseUrl(): string {
  if (typeof window === "undefined") return CONFIGURED_ENGINE_BASE_URL;
  try {
    const configured = new URL(CONFIGURED_ENGINE_BASE_URL);
    if (
      window.location.hostname === "127.0.0.1" &&
      configured.hostname === "localhost"
    ) {
      configured.hostname = "127.0.0.1";
      return configured.toString().replace(/\/$/, "");
    }
    return configured.toString().replace(/\/$/, "");
  } catch {
    return CONFIGURED_ENGINE_BASE_URL;
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json()) as APIResponse<T>;
  if (!response.ok || !body.success || body.data === null) {
    throw new Error(body.error || `Request failed with ${response.status}`);
  }
  return body.data;
}

export async function transcribeAudio(audio: Blob): Promise<STTResponse> {
  const form = new FormData();
  form.append("file", audio, "patient-question.wav");
  let response: Response;
  try {
    response = await fetch(`${getEngineBaseUrl()}/stt`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new Error(
      `Không kết nối được STT backend tại ${getEngineBaseUrl()}. Kiểm tra Navigation Engine đang chạy trên cổng 8001.`,
    );
  }
  return unwrap<STTResponse>(response);
}

export async function askAssistant(message: string, sessionId?: string): Promise<AssistantResponse> {
  const response = await fetch(`${getEngineBaseUrl()}/assistant/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId || null }),
  });
  return unwrap<AssistantResponse>(response);
}

export async function sendChatMessage(
  text: string,
  sessionContext: ChatbotSessionContext = {},
): Promise<ChatbotMessageResponse> {
  const response = await fetch(`${getEngineBaseUrl()}/api/chatbot/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionContext.session_id || "anonymous_session",
      sender_id: sessionContext.sender_id || sessionContext.session_id || "anonymous_patient",
      text,
      metadata: sessionContext.metadata || {},
    }),
  });
  return unwrap<ChatbotMessageResponse>(response);
}

export async function startPatientSession(): Promise<PatientSession> {
  const response = await fetch(`${getEngineBaseUrl()}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_id: "standard_outpatient_v1" }),
  });
  return unwrap<PatientSession>(response);
}

export async function extractOcr(file: File | null, scenario = "clear"): Promise<OcrResult> {
  const form = new FormData();
  form.append("scenario", scenario);
  if (file) {
    form.append("file", file, file.name);
  }
  const response = await fetch(`${getEngineBaseUrl()}/ocr/extract`, {
    method: "POST",
    body: form,
  });
  return unwrap<OcrResult>(response);
}

export async function confirmOcr(
  sessionId: string,
  result: OcrResult,
): Promise<PatientSession> {
  const completedSteps = [
    "register",
    "identity",
    "payment",
  ];
  const fields = {
    ...result.fields,
    completed_steps:
      result.fields.completed_steps && result.fields.completed_steps.length > 0
        ? result.fields.completed_steps
        : completedSteps,
  };
  const response = await fetch(`${getEngineBaseUrl()}/session/${sessionId}/confirm-ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields, confidence: result.confidence }),
  });
  return unwrap<PatientSession>(response);
}

export async function markArrived(sessionId: string): Promise<PatientSession> {
  const response = await fetch(`${getEngineBaseUrl()}/session/${sessionId}/arrive`, {
    method: "POST",
  });
  return unwrap<PatientSession>(response);
}
