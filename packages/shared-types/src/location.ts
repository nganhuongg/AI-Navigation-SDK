// Types for physical hospital locations (rooms, kiosks, counters).
export type Location = {
  location_id: string;
  poi_id: string;
  building_id: string;
  floor_id: string;
  department_id: string;
  label: string;
  function: string;
  opening_hours: string;
  voice_aliases: string[];
};

export type Department = {
  department_id: string;
  name: string;
  name_vi: string;
};

export type Building = {
  building_id: string;
  name: string;
};

export type Floor = {
  floor_id: string;
  building_id: string;
  level: number;
  raw_map_file: string;
};
