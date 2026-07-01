// Types for a blank care journey template that is copied into each patient session.
export type JourneyCheckpoint = {
  room: string;
  location_code: string;
  floor: number;
  is_done: boolean;
  completed_at: string | null;
};

export type ExtractedJourneyFields = {
  specialty: string | null;
  initial_exam_room: string | null;
  ordered_services: string[];
  return_room: string | null;
  queue_number: string | number | null;
  completed_steps: string[];
};

export type SpecializedServiceStatus = "pending" | "in_progress" | "completed" | "skipped";

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
  status: SpecializedServiceStatus;
  completed_at: string | null;
  next_step: string | null;
};

export type SpecializedProcess = {
  services: SpecializedService[];
  return_room: string | null;
};

export type PatientJourneyState = {
  patient_id: string | null;
  session_id: string | null;
  register: JourneyCheckpoint;
  identity: JourneyCheckpoint;
  payment: JourneyCheckpoint;
  specialized_process_updated: boolean;
  specialized_process: SpecializedProcess | null;
  extracted_fields: ExtractedJourneyFields;
  current_step: string;
  next_action: string | null;
  confidence_score: number | null;
  requires_user_confirmation: boolean;
};

export type CareJourneyUpdateMode = {
  mode: "hospital_app_api" | "paper_form_ocr";
  description_vi: string;
  fills: string[];
};

export type CareJourneyTemplate = {
  template_id: string;
  version: number;
  template_type: "blank_patient_journey";
  name: {
    vi: string;
    en: string;
  };
  description: {
    vi: string;
    en: string;
  };
  source_basis: string[];
  privacy: {
    stores_patient_identity: boolean;
    patient_identifier_policy: string;
    session_ttl_minutes: number;
    allowed_extracted_fields: string[];
  };
  update_modes: CareJourneyUpdateMode[];
  patient_journey_template: PatientJourneyState;
  specialized_process_blueprint: SpecializedProcess;
  example_after_update?: PatientJourneyState;
  fallbacks: Array<{
    fallback_id: string;
    trigger: string;
    message_vi: string;
  }>;
};
