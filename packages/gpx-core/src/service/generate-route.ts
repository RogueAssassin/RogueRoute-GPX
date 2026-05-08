import type { RouteRequest } from "../domain/route-options";
import type { RawWaypoint } from "../domain/waypoint";
import { buildGpxFromRoutePlan } from "../gpx/build-gpx";
import { normalizeWaypoints } from "../input/normalize-waypoints";
import { orderWaypoints } from "../optimization/order-waypoints";
import { createRouterFromEnv } from "../routing/create-router";
import { computeRouteStats } from "../stats/compute-route-stats";

export async function generateRoute(input: {
  rawWaypoints: RawWaypoint[];
  request: RouteRequest;
  env: {
    ROUTER_MODE?: string;
    OSRM_URL?: string;
    OSRM_PROFILE?: string;
    OSRM_SNAP_RADIUS_METERS?: string;
  };
}) {
  const normalized = normalizeWaypoints(input.rawWaypoints);
  if (normalized.length < 2) throw new Error("At least two waypoints are required.");

  const ordered = orderWaypoints(normalized, input.request);
  const router = createRouterFromEnv(input.env);
  const plan = await router.route(ordered, input.request);
  const stats = computeRouteStats(plan);
  const gpx = buildGpxFromRoutePlan(plan, input.request.name ?? "Generated Route");

  return { plan, stats, gpx, orderedWaypoints: ordered };
}
