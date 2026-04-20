import type { MapState } from "./map-state";
import type { RawWaypoint } from "./waypoint";

export type ExportPayload = {
  routeName?: string;
  map?: MapState;
  waypoints: RawWaypoint[];
  source?: {
    type: string;
    pluginVersion?: string;
  };
};
