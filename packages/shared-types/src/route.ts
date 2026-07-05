// Types for route requests and results.
export type RouteRequest = {
  session_id?: string;
  start_location_id?: string;
  destination_location_id?: string;
};

export type RouteInstruction = {
  step: number;
  text: string;
  text_vi: string;
};

export type RouteResult = {
  route_id: string;
  start_location_id?: string;
  destination_location_id: string;
  start_room?: string;
  destination_room: string;
  map_available: boolean;
  node_path: string[];
  polyline: Array<{ x: number; y: number; floor?: number }>;
  instructions: RouteInstruction[];
  estimated_seconds: number;
};
