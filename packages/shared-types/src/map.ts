// Types for the digital floor map (nodes, edges, POIs, and status).
// Filled in on Day 2 when the data schemas are defined.
export type MapStatus = "draft" | "verified";

export type MapNode = {
  node_id: string;
  x: number;
  y: number;
  type: "corridor" | "room" | "elevator" | "stairs";
};

export type MapEdge = {
  edge_id: string;
  from_node: string;
  to_node: string;
  weight: number;
};

export type POI = {
  poi_id: string;
  node_id: string;
  location_id: string;
  label: string;
};

export type DigitalMap = {
  map_id: string;
  hospital_id: string;
  building_id: string;
  floor_id: string;
  status: MapStatus;
  image: string;
  nodes: MapNode[];
  edges: MapEdge[];
  pois: POI[];
  version: number;
};
