import type { ExportPayload } from "@rogue/gpx-core";
import { normalizeWaypoints } from "@rogue/gpx-core";

export type IitcMarker = {
  lat: number;
  lng: number;
  name?: string;
};

export function parseIitcMarkers(input: IitcMarker[]) {
  return normalizeWaypoints(input);
}

export function buildIitcExportPayload(input: {
  routeName?: string;
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  markers: IitcMarker[];
  pluginVersion?: string;
}): ExportPayload {
  return {
    routeName: input.routeName,
    map:
      typeof input.centerLat === "number" &&
      typeof input.centerLng === "number" &&
      typeof input.zoom === "number"
        ? {
            centerLat: input.centerLat,
            centerLng: input.centerLng,
            zoom: input.zoom
          }
        : undefined,
    waypoints: input.markers.map((marker) => ({
      lat: marker.lat,
      lng: marker.lng,
      name: marker.name
    })),
    source: {
      type: "iitc-ce",
      pluginVersion: input.pluginVersion
    }
  };
}
