// Types for the patient's active session and their next action.
export type NextAction = {
  type: "navigate" | "wait" | "confirm" | "done";
  target_location_id: string | null;
  message: string;
};

export type SessionContext = {
  session_id: string;
  template_id: string;
  current_location_id: string | null;
  current_step_id: string;
  completed_steps: string[];
  pending_steps: string[];
  target_location_id: string | null;
  last_user_intent: string | null;
  confidence_score: number;
  expires_at: string;
  next_action: NextAction | null;
};
