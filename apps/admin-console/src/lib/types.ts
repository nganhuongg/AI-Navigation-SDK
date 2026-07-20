export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

export type ServiceStatus = { real: boolean };

export type HealthStatus = {
  status: string;
  service: string;
  services: {
    ocr: ServiceStatus;
    smartvoice_stt: ServiceStatus;
    smartvoice_tts: ServiceStatus;
    smartbot: ServiceStatus;
  };
};

export type OCRFields = {
  initial_exam_room: string | null;
  ordered_services: string[];
  return_room: string | null;
  detected_room_codes: string[];
  room_descriptions: Record<string, string>;
  room_notes: Record<string, string>;
  room_queue_numbers: Record<string, string>;
};

export type OCRResult = {
  ocr_result_id: string;
  source_image: string;
  confidence: number;
  fields: OCRFields;
  requires_user_confirmation: boolean;
  is_low_confidence: boolean;
};

export type JourneyCheckpoint = {
  room: string;
  location_code: string;
  floor: number;
  is_done: boolean;
  completed_at: string | null;
};

export type SpecializedService = {
  service_id: string;
  service_name: string;
  room: string;
  room_name: string;
  floor: number;
  status: "pending" | "in_progress" | "completed" | "skipped";
  completed_at: string | null;
};

export type SessionContext = {
  session_id: string;
  template_id: string;
  journey: {
    register: JourneyCheckpoint;
    identity: JourneyCheckpoint;
    payment: JourneyCheckpoint;
    specialized_process_updated: boolean;
    specialized_process: {
      services: SpecializedService[];
      return_room: string | null;
    } | null;
    extracted_fields: {
      specialty: string | null;
      initial_exam_room: string | null;
      ordered_services: string[];
      detected_room_codes: string[];
      room_descriptions: Record<string, string>;
      room_notes: Record<string, string>;
      room_queue_numbers: Record<string, string>;
      return_room: string | null;
      queue_number: string | number | null;
      completed_steps: string[];
      source: "ocr" | "hospital_api" | "manual" | null;
    };
    current_step: string;
    confidence_score: number | null;
    requires_user_confirmation: boolean;
  };
  next_action: {
    type: "navigate" | "scan" | "confirm" | "wait" | "done";
    target_location_id: string | null;
    target_room: string | null;
    message: string;
  };
};

export type CareJourneyCheckpoint = {
  room: string;
  location_code: string;
  floor: number;
  is_done: boolean;
  completed_at: string | null;
};

export type CareJourneyService = {
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
  completed_at: string | null;
  next_step: string | null;
  [key: string]: string | number | null | undefined;
};

export type CareJourneyTableColumn = {
  key: string;
  label: string;
  description: string;
};

export type CareJourneyTemplate = {
  template_id: string;
  version: number;
  template_type: "blank_patient_journey";
  name: { vi: string; en: string };
  description: { vi: string; en: string };
  source_basis: string[];
  privacy: {
    stores_patient_identity: boolean;
    patient_identifier_policy: string;
    session_ttl_minutes: number;
    allowed_extracted_fields: string[];
    ocr_service_columns?: CareJourneyTableColumn[];
  };
  update_modes: Array<{
    mode: "hospital_app_api" | "paper_form_ocr";
    description_vi: string;
    fills: string[];
  }>;
  patient_journey_template: {
    patient_id: string | null;
    session_id: string | null;
    register: CareJourneyCheckpoint;
    identity: CareJourneyCheckpoint;
    payment: CareJourneyCheckpoint;
    specialized_process_updated: boolean;
    specialized_process: { services: CareJourneyService[]; return_room: string | null } | null;
    extracted_fields: {
      specialty: string | null;
      initial_exam_room: string | null;
      ordered_services: string[];
      detected_room_codes: string[];
      room_descriptions: Record<string, string>;
      room_notes: Record<string, string>;
      room_queue_numbers: Record<string, string>;
      return_room: string | null;
      queue_number: string | number | null;
      completed_steps: string[];
      source: "ocr" | "hospital_api" | "manual" | null;
    };
    current_step: string;
    next_action: string | null;
    confidence_score: number | null;
    requires_user_confirmation: boolean;
  };
  specialized_process_blueprint: {
    services: CareJourneyService[];
    return_room: string | null;
  };
  example_after_update?: unknown;
  fallbacks: Array<{
    fallback_id: string;
    trigger: string;
    message_vi: string;
  }>;
};

export type CareJourneyTemplateSummary = Pick<
  CareJourneyTemplate,
  "template_id" | "version" | "template_type" | "name"
>;

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

export type TTSResponse = {
  audio_base64: string;
  media_type: string;
  sample_rate: number;
};

export type SmartBotCard = {
  type?: string;
  text?: string;
  title?: string;
  description?: string;
  buttons?: Array<Record<string, unknown>>;
  audio_url?: string;
  play_type?: string;
  [key: string]: unknown;
};

export type ChatbotMetadata = {
  current_step?: string | null;
  target_room?: string | null;
  target_floor?: string | null;
  next_action?: string | null;
  accessibility_mode?: string | null;
};

export type ChatbotMessageResponse = {
  reply_text: string;
  cards: SmartBotCard[];
  intent_name: string | null;
  handoff_required: boolean;
};

export type MapStatus = "draft" | "verified";

export type MapFloor = {
  floor_id: string;
  floor_number: number;
  image_width: number;
  image_height: number;
  source_image: string;
};

export type MapNode = {
  node_id: string;
  x: number;
  y: number;
  floor_number: number;
  kind: "corridor" | "room" | "elevator" | "stairs";
  location_id?: string | null;
  poi_id?: string | null;
  label?: string | null;
};

export type MapEdge = {
  edge_id: string;
  from_node: string;
  to_node: string;
  weight: number;
  kind: "walkway" | "door" | "elevator" | "stairs";
};

export type MapPOI = {
  poi_id: string;
  location_id: string;
  node_id: string;
  label: string;
  x: number;
  y: number;
  floor_number: number;
};

export type DigitalMap = {
  map_id: string;
  hospital_id: string;
  building_id: string;
  status: MapStatus;
  version: number;
  floors: MapFloor[];
  nodes: MapNode[];
  edges: MapEdge[];
  pois: MapPOI[];
  created_at: string;
  verified_at?: string | null;
};

export type MapListItem = {
  map_id: string;
  status: MapStatus;
  version: number;
  floor_count: number;
  node_count: number;
  edge_count: number;
  poi_count: number;
  created_at: string;
  verified_at?: string | null;
};

export type RouteResult = {
  map_available: boolean;
  destination_room: string;
  node_path: string[];
  polyline: Array<{ x: number; y: number; floor?: number }>;
  instructions: Array<{ step: number; text_vi: string }>;
};
