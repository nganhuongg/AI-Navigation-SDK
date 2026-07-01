// Types for the AI assistant request/response.
export type IntentType =
  | "ask_next_step"
  | "ask_route"
  | "ask_current_status"
  | "out_of_scope_medical"
  | "unknown";

export type AssistantRequest = {
  session_id: string;
  message: string;
};

export type AssistantResponse = {
  intent: IntentType;
  response_text: string;
  confidence: number;
  is_fallback: boolean;
};
