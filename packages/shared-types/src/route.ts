// Types for route requests and results.
export type RouteRequest = {
  session_id: string;
  start_location_id: string;
  destination_location_id: string;
};

export type RouteInstruction = {
  step: number;
  text: string;
  text_vi: string;
};

export type RouteResult = {
  route_id: string;
  start_location_id: string;
  destination_location_id: string;
  node_path: string[];
  polyline: Array<{ x: number; y: number }>;
  instructions: RouteInstruction[];
  estimated_seconds: number;
};
