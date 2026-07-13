import type { RouteRequest } from "../domain/route-options";
import type { RawWaypoint } from "../domain/waypoint";
import { buildGpxFromRoutePlan } from "../gpx/build-gpx";
import { simplifyRoutePlan } from "../gpx/simplify-track";
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
    OSRM_SNAP_MAX_RADIUS_METERS?: string;
    OSRM_MAX_PARALLEL_LEGS?: string;
    GPX_MAX_TRACK_POINTS?: string;
    GPX_SIMPLIFY_TOLERANCE_METERS?: string;
  };
}) {
  const normalized = normalizeWaypoints(input.rawWaypoints);
  if (normalized.length < 2) throw new Error("At least two waypoints are required.");

  const ordered = orderWaypoints(normalized, input.request);
  const router = createRouterFromEnv(input.env);
  const routedPlan = await router.route(ordered, input.request);
  const maxTrackPoints = Number(input.env.GPX_MAX_TRACK_POINTS ?? "1000");
  const toleranceMeters = Number(input.env.GPX_SIMPLIFY_TOLERANCE_METERS ?? "2.5");
  const plan = simplifyRoutePlan(routedPlan, {
    detail: input.request.geometryDetail ?? "auto",
    maxTrackPoints: Number.isFinite(maxTrackPoints) ? maxTrackPoints : undefined,
    toleranceMeters: Number.isFinite(toleranceMeters) ? toleranceMeters : undefined,
  });
  if (!plan.geometrySummary?.withinPointLimit) {
    plan.warnings = [
      ...(plan.warnings ?? []),
      `The route still needs ${plan.geometrySummary?.trackPointCount ?? "more than the configured number of"} track points because routed waypoint boundaries are always preserved. Split this route into smaller files or choose Compact export.`,
    ];
  }
  const stats = computeRouteStats(plan);
  const gpx = buildGpxFromRoutePlan(plan, input.request.name ?? "Generated Route");

  return { plan, stats, gpx, orderedWaypoints: ordered };
}
