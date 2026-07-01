// Types for anonymous analytics events and the dashboard summary.
export type AnalyticsEvent = {
  event_id: string;
  event_type: string;
  session_id: string;
  timestamp: string;
  metadata: Record<string, string | number | boolean>;
};

export type DashboardSummary = {
  total_sessions: number;
  total_routes_requested: number;
  total_steps_completed: number;
  total_fallbacks: number;
  top_locations: Array<{ location_id: string; count: number }>;
  recent_fallbacks: Array<{ event_id: string; reason: string; timestamp: string }>;
};
