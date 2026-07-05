// Types for the AI assistant request/response.
export type IntentType =
  | "ask_next_step"
  | "ask_route"
  | "ask_current_status"
  | "out_of_scope_medical"
  | "unknown";

export type AssistantRequest = {
  message: string;
  session_id: string | null; // optional: some questions need no session
};

export type ChatbotMetadata = {
  current_step?: string | null;
  target_room?: string | null;
  target_floor?: string | null;
  next_action?: string | null;
  accessibility_mode?: string | null;
};

export type ChatbotMessageRequest = {
  session_id: string;
  sender_id: string;
  text: string;
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

export type AssistantResponse = {
  intent: IntentType;
  response_text: string;
  confidence: number;
  is_fallback: boolean;
  // When the answer points at a room, these help the UI offer a "chỉ đường" button.
  target_location_id: string | null;
  target_room: string | null;
};
