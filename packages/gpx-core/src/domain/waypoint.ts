export type Waypoint = {
  id: string;
  lat: number;
  lng: number;
  name?: string;
};

export type RawWaypoint = {
  id?: string;
  lat: number;
  lng: number;
  name?: string;
};
