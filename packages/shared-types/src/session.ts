// Types for the patient's active session and their next action.
//
// A session is a runtime copy of the care journey template's patient_journey
// (see PatientJourneyState in ./journey) wrapped in a small envelope, plus a
// computed, structured next_action for the UI. This mirrors the backend
// SessionContext model and the care_journey_template JSON schema.
import type { PatientJourneyState } from "./journey";

export type NextActionType = "navigate" | "scan" | "confirm" | "wait" | "done";

export type NextAction = {
  type: NextActionType;
  target_location_id: string | null; // e.g. "loc_A303"
  target_room: string | null; // e.g. "A303"
  message: string;
};

export type SessionContext = {
  session_id: string;
  template_id: string;
  created_at: string;
  expires_at: string;
  current_location: string | null; // room code, if the patient tells us
  last_user_intent: string | null;
  journey: PatientJourneyState;
  next_action: NextAction;
};

export type ExtractedFieldSource = "ocr" | "hospital_api" | "manual";

export type ConfirmOcrFields = {
  initial_exam_room?: string | null;
  ordered_services?: string[];
  detected_room_codes?: string[];
  room_descriptions?: Record<string, string>;
  room_notes?: Record<string, string>;
  room_queue_numbers?: Record<string, string>;
  return_room?: string | null;
  specialty?: string | null;
  queue_number?: string | number | null;
  completed_steps?: string[];
};

export type ConfirmOcrRequest = {
  fields: ConfirmOcrFields;
  confidence?: number | null;
};

export type ApplyExtractedFieldsRequest = {
  fields: ConfirmOcrFields;
  confidence?: number | null;
  source: ExtractedFieldSource;
};
