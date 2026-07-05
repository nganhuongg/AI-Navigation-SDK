// Types for the digital floor map (nodes, edges, POIs, and status).
// Filled in on Day 2 when the data schemas are defined.
export type MapStatus = "draft" | "verified";

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

export type POI = {
  poi_id: string;
  node_id: string;
  location_id: string;
  label: string;
  x: number;
  y: number;
  floor_number: number;
};

export type MapFloor = {
  floor_id: string;
  floor_number: number;
  image_width: number;
  image_height: number;
  source_image: string;
};

export type DigitalMap = {
  map_id: string;
  hospital_id: string;
  building_id: string;
  status: MapStatus;
  floors: MapFloor[];
  nodes: MapNode[];
  edges: MapEdge[];
  pois: POI[];
  version: number;
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
