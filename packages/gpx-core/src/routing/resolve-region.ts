/** [minLon, minLat, maxLon, maxLat] */
export type RegionBox = [number, number, number, number];

export type RegionCandidate = {
  key: string;
  label: string;
  bounds: RegionBox[];
  prepared: boolean;
};

export type RegionResolution =
  | { ok: true; region: RegionCandidate }
  | { ok: false; reason: "no-waypoints" | "outside-catalog" | "not-prepared"; message: string; matches: RegionCandidate[] };

type Point = { lat: number; lng: number };

function boxContains([minLon, minLat, maxLon, maxLat]: RegionBox, point: Point) {
  return point.lng >= minLon && point.lng <= maxLon && point.lat >= minLat && point.lat <= maxLat;
}

function regionContains(region: RegionCandidate, point: Point) {
  return region.bounds.some((box) => boxContains(box, point));
}

function regionArea(region: RegionCandidate) {
  return region.bounds.reduce((sum, [minLon, minLat, maxLon, maxLat]) => sum + (maxLon - minLon) * (maxLat - minLat), 0);
}

/**
 * Pick the region whose bounds contain every waypoint. Among prepared matches the active
 * region wins (no switch needed), then the smallest area, so a country graph is preferred
 * over the continent that contains it.
 */
export function resolveRegion(
  points: Point[],
  regions: RegionCandidate[],
  activeRegion?: string,
): RegionResolution {
  if (points.length === 0) {
    return { ok: false, reason: "no-waypoints", message: "No waypoints to locate.", matches: [] };
  }
  const matches = regions
    .filter((region) => points.every((point) => regionContains(region, point)))
    .sort((a, b) => regionArea(a) - regionArea(b));
  if (matches.length === 0) {
    return {
      ok: false,
      reason: "outside-catalog",
      message: "The waypoints are not inside any single supported region. Split the route by region or pick a region manually.",
      matches,
    };
  }
  const prepared = matches.filter((region) => region.prepared);
  if (prepared.length === 0) {
    return {
      ok: false,
      reason: "not-prepared",
      message: `These waypoints need the ${matches.map((region) => region.label).join(" or ")} map, which is not prepared on this server yet.`,
      matches,
    };
  }
  const active = prepared.find((region) => region.key === activeRegion);
  return { ok: true, region: active ?? prepared[0] };
}
