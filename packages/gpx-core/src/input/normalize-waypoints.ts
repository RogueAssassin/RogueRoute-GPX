import type { RawWaypoint, Waypoint } from "../domain/waypoint";

export function normalizeWaypoints(input: RawWaypoint[]): Waypoint[] {
  return input
    .map((point, index) => ({
      id: point.id ?? `wp-${index + 1}`,
      lat: Number(point.lat),
      lng: Number(point.lng),
      name: point.name?.trim() || undefined,
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}
