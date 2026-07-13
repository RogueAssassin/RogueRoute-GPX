import type { GeometryDetail } from "../domain/route-options";
import type { RouteLeg, RoutePlan } from "../domain/route-plan";

type Point = [number, number];

export type TrackSimplificationOptions = {
  detail?: GeometryDetail;
  maxTrackPoints?: number;
  toleranceMeters?: number;
};

const EARTH_RADIUS_METERS = 6_371_000;

function isValidPoint(point: Point): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function samePoint(a: Point | undefined, b: Point): boolean {
  return Boolean(a && a[0] === b[0] && a[1] === b[1]);
}

function cleanPoints(points: Point[]): Point[] {
  const cleaned: Point[] = [];
  for (const point of points) {
    if (!isValidPoint(point) || samePoint(cleaned.at(-1), point)) continue;
    cleaned.push(point);
  }
  return cleaned;
}

function projectedPoint(point: Point, referenceLatitudeRadians: number): [number, number] {
  const latitudeRadians = (point[0] * Math.PI) / 180;
  const longitudeRadians = (point[1] * Math.PI) / 180;
  return [
    longitudeRadians * EARTH_RADIUS_METERS * Math.cos(referenceLatitudeRadians),
    latitudeRadians * EARTH_RADIUS_METERS,
  ];
}

function distanceToSegmentMeters(point: Point, start: Point, end: Point): number {
  const referenceLatitudeRadians = (((start[0] + end[0]) / 2) * Math.PI) / 180;
  const [px, py] = projectedPoint(point, referenceLatitudeRadians);
  const [ax, ay] = projectedPoint(start, referenceLatitudeRadians);
  const [bx, by] = projectedPoint(end, referenceLatitudeRadians);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);

  const position = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + position * dx), py - (ay + position * dy));
}

/**
 * Iterative Ramer-Douglas-Peucker simplification. The first and last points
 * are always retained, so applying it per route leg also retains every routed
 * waypoint/leg boundary.
 */
export function simplifyLine(points: Point[], toleranceMeters: number): Point[] {
  const cleaned = cleanPoints(points);
  if (cleaned.length <= 2 || toleranceMeters <= 0) return cleaned;

  const retained = new Set<number>([0, cleaned.length - 1]);
  const ranges: Array<[number, number]> = [[0, cleaned.length - 1]];

  while (ranges.length > 0) {
    const [startIndex, endIndex] = ranges.pop()!;
    let furthestIndex = -1;
    let furthestDistance = -1;

    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = distanceToSegmentMeters(
        cleaned[index],
        cleaned[startIndex],
        cleaned[endIndex],
      );
      if (distance > furthestDistance) {
        furthestDistance = distance;
        furthestIndex = index;
      }
    }

    if (furthestIndex > startIndex && furthestDistance > toleranceMeters) {
      retained.add(furthestIndex);
      ranges.push([startIndex, furthestIndex], [furthestIndex, endIndex]);
    }
  }

  return [...retained]
    .sort((a, b) => a - b)
    .map((index) => cleaned[index]);
}

export function flattenRoutePlanPoints(plan: Pick<RoutePlan, "legs">): Point[] {
  const points: Point[] = [];
  for (const leg of plan.legs) {
    for (const point of leg.geometry) {
      if (!isValidPoint(point) || samePoint(points.at(-1), point)) continue;
      points.push(point);
    }
  }
  return points;
}

function simplifyLegs(legs: RouteLeg[], toleranceMeters: number): RouteLeg[] {
  return legs.map((leg) => ({
    ...leg,
    geometry: simplifyLine(leg.geometry, toleranceMeters),
  }));
}

function countLegPoints(legs: RouteLeg[]): number {
  return flattenRoutePlanPoints({ legs }).length;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! > 1 ? Math.floor(value!) : fallback;
}

function nonNegativeNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! >= 0 ? value! : fallback;
}

export function simplifyRoutePlan(
  plan: RoutePlan,
  options: TrackSimplificationOptions = {},
): RoutePlan {
  const detail = options.detail ?? "auto";
  const sourceTrackPointCount = plan.legs.reduce((sum, leg) => sum + leg.geometry.length, 0);
  const cleanedLegs = simplifyLegs(plan.legs, 0);
  const cleanedTrackPointCount = countLegPoints(cleanedLegs);
  const duplicateTrackPointCount = Math.max(0, sourceTrackPointCount - cleanedTrackPointCount);

  const defaultPointLimit = detail === "compact" ? 600 : 1_000;
  const requestedLimit = positiveInteger(options.maxTrackPoints, defaultPointLimit);
  const pointLimit = detail === "compact" ? Math.min(requestedLimit, 600) : requestedLimit;
  const initialTolerance =
    detail === "compact"
      ? Math.max(5, nonNegativeNumber(options.toleranceMeters, 5))
      : nonNegativeNumber(options.toleranceMeters, 2.5);

  let toleranceMeters = detail === "full" ? 0 : initialTolerance;
  let legs = detail === "full" ? cleanedLegs : simplifyLegs(cleanedLegs, toleranceMeters);
  let trackPointCount = countLegPoints(legs);

  if (detail !== "full" && trackPointCount > pointLimit) {
    const maxTolerance = detail === "compact" ? 25 : 10;
    let lower = toleranceMeters;
    let upper = Math.max(1, toleranceMeters);
    let upperLegs = legs;
    let upperCount = trackPointCount;

    while (upper < maxTolerance && upperCount > pointLimit) {
      lower = upper;
      upper = Math.min(maxTolerance, upper * 2);
      upperLegs = simplifyLegs(cleanedLegs, upper);
      upperCount = countLegPoints(upperLegs);
    }

    if (upperCount <= pointLimit) {
      for (let iteration = 0; iteration < 14; iteration += 1) {
        const middle = (lower + upper) / 2;
        const middleLegs = simplifyLegs(cleanedLegs, middle);
        const middleCount = countLegPoints(middleLegs);
        if (middleCount <= pointLimit) {
          upper = middle;
          upperLegs = middleLegs;
          upperCount = middleCount;
        } else {
          lower = middle;
        }
      }
    }

    toleranceMeters = upper;
    legs = upperLegs;
    trackPointCount = upperCount;
  }

  const withinPointLimit = detail === "full" || trackPointCount <= pointLimit;

  return {
    ...plan,
    legs,
    geometrySummary: {
      detail,
      sourceTrackPointCount,
      trackPointCount,
      removedTrackPointCount: Math.max(0, sourceTrackPointCount - trackPointCount),
      duplicateTrackPointCount,
      toleranceMeters: Number(toleranceMeters.toFixed(2)),
      pointLimit: detail === "full" ? undefined : pointLimit,
      withinPointLimit,
    },
  };
}
