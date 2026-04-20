import type { RouteRequest } from "../domain/route-options";
import type { Waypoint } from "../domain/waypoint";
import { haversineMeters } from "../utils/geo";

function nearestNeighbor(start: Waypoint, pool: Waypoint[]): Waypoint[] {
  const remaining = [...pool];
  const ordered: Waypoint[] = [];
  let current = start;

  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = haversineMeters(current, remaining[0]);

    for (let index = 1; index < remaining.length; index += 1) {
      const candidateDistance = haversineMeters(current, remaining[index]);
      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance;
        bestIndex = index;
      }
    }

    current = remaining.splice(bestIndex, 1)[0];
    ordered.push(current);
  }

  return ordered;
}

export function orderWaypoints(waypoints: Waypoint[], request: RouteRequest): Waypoint[] {
  if (waypoints.length <= 2 || request.mode === "preserve-order") return [...waypoints];

  if (request.mode === "loop") {
    const start = waypoints[0];
    const rest = waypoints.slice(1);
    return [start, ...nearestNeighbor(start, rest), start];
  }

  const keepStartFixed = request.keepStartFixed ?? true;
  const keepEndFixed = request.keepEndFixed ?? true;

  const start = keepStartFixed ? waypoints[0] : undefined;
  const end = keepEndFixed ? waypoints[waypoints.length - 1] : undefined;

  let middle = [...waypoints];
  if (keepStartFixed) middle = middle.slice(1);
  if (keepEndFixed) middle = middle.slice(0, -1);

  const anchor = start ?? middle.shift() ?? waypoints[0];
  const orderedMiddle = nearestNeighbor(anchor, middle);

  const ordered: Waypoint[] = [];
  if (keepStartFixed && start) ordered.push(start);
  else ordered.push(anchor);

  ordered.push(...orderedMiddle);

  if (keepEndFixed && end) ordered.push(end);

  return ordered;
}
