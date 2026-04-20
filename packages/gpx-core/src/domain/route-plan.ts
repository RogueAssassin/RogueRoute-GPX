import type { RouteMode } from "./route-options";
import type { Waypoint } from "./waypoint";

export type RouteLeg = {
  from: Waypoint;
  to: Waypoint;
  distanceMeters: number;
  durationSeconds: number;
  geometry: [number, number][];
  overrideUsed?: boolean;
  warning?: string;
};

export type RoutePlan = {
  orderedWaypoints: Waypoint[];
  legs: RouteLeg[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  mode: "direct" | "valhalla";
  routeMode: RouteMode;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  warnings?: string[];
};
