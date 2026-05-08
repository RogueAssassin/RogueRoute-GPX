import type { RoutePlan, RouteLeg } from "../domain/route-plan";
import type { RouteRequest } from "../domain/route-options";
import type { Waypoint } from "../domain/waypoint";
import type { Router } from "./router";
import { computeBounds, haversineMeters } from "../utils/geo";

export class DirectRouter implements Router {
  async route(waypoints: Waypoint[], request: RouteRequest): Promise<RoutePlan> {
    if (request.strictLandRouting && !request.allowManualOverride) {
      throw new Error(
        "Strict land routing is enabled, but the app is running in direct mode. Enable OSRM or allow manual override."
      );
    }

    const legs: RouteLeg[] = [];
    const warnings: string[] = [];

    for (let index = 0; index < waypoints.length - 1; index += 1) {
      const from = waypoints[index];
      const to = waypoints[index + 1];
      const distanceMeters = haversineMeters(from, to);
      const durationSeconds = distanceMeters / 1.35;
      const overrideUsed = Boolean(request.strictLandRouting && request.allowManualOverride);
      const warning = overrideUsed
        ? `Leg ${index + 1} used manual override because direct mode cannot verify land-safe routing.`
        : undefined;

      if (warning) warnings.push(warning);

      legs.push({
        from,
        to,
        distanceMeters,
        durationSeconds,
        geometry: [
          [from.lat, from.lng],
          [to.lat, to.lng],
        ],
        overrideUsed,
        warning,
      });
    }

    return {
      orderedWaypoints: waypoints,
      legs,
      totalDistanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
      totalDurationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
      mode: "direct",
      routeMode: request.mode,
      bounds: computeBounds(waypoints),
      warnings,
    };
  }
}
