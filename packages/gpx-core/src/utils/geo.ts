import type { Waypoint } from "../domain/waypoint";

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineMeters(a: Waypoint, b: Waypoint): number {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

export function computeBounds(points: Array<{ lat: number; lng: number }>) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);

  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}
