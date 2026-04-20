import type { RoutePlan, RouteLeg } from "../domain/route-plan";
import type { RouteRequest } from "../domain/route-options";
import type { Waypoint } from "../domain/waypoint";
import type { Router } from "./router";
import { computeBounds, haversineMeters } from "../utils/geo";
import { decodePolyline } from "../utils/polyline";

type ValhallaConfig = {
  baseUrl: string;
  costing?: "pedestrian" | "auto" | "bicycle";
};

type ValhallaTrip = {
  legs?: Array<{
    shape?: string;
    summary?: {
      length?: number;
      time?: number;
    };
  }>;
};

type ValhallaResponse = {
  trip?: ValhallaTrip;
};

function fallbackLeg(from: Waypoint, to: Waypoint, index: number, reason: string): RouteLeg {
  const distanceMeters = haversineMeters(from, to);
  return {
    from,
    to,
    distanceMeters,
    durationSeconds: distanceMeters / 1.35,
    geometry: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    overrideUsed: true,
    warning: `Leg ${index + 1} used manual override: ${reason}`,
  };
}

export class ValhallaRouter implements Router {
  private readonly baseUrl: string;
  private readonly costing: "pedestrian" | "auto" | "bicycle";

  constructor(config: ValhallaConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.costing = config.costing ?? "pedestrian";
  }

  async route(waypoints: Waypoint[], request: RouteRequest): Promise<RoutePlan> {
    const legs: RouteLeg[] = [];
    const warnings: string[] = [];

    for (let index = 0; index < waypoints.length - 1; index += 1) {
      const from = waypoints[index];
      const to = waypoints[index + 1];

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/route`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locations: [
              { lat: from.lat, lon: from.lng },
              { lat: to.lat, lon: to.lng },
            ],
            costing: this.costing,
            costing_options: {
              [this.costing]: {
                use_ferry: request.allowFerries ? 1 : 0,
              },
            },
            directions_options: { units: "kilometers" },
          }),
        });
      } catch (error) {
        if (request.allowManualOverride) {
          const leg = fallbackLeg(
            from,
            to,
            index,
            error instanceof Error ? error.message : "Valhalla request failed"
          );
          legs.push(leg);
          if (leg.warning) warnings.push(leg.warning);
          continue;
        }
        throw error;
      }

      if (!response.ok) {
        const body = await response.text();
        const reason = `Valhalla routing failed on leg ${index + 1}: ${response.status} ${body}`;
        if (request.allowManualOverride) {
          const leg = fallbackLeg(from, to, index, reason);
          legs.push(leg);
          if (leg.warning) warnings.push(leg.warning);
          continue;
        }
        throw new Error(reason);
      }

      const data = (await response.json()) as ValhallaResponse;
      const valhallaLeg = data.trip?.legs?.[0];

      if (!valhallaLeg?.shape) {
        if (request.strictLandRouting && !request.allowManualOverride) {
          throw new Error(
            `No routed land-safe geometry was returned for leg ${index + 1}. Enable manual override to force a direct segment.`
          );
        }

        const leg = fallbackLeg(from, to, index, "No route geometry returned by Valhalla");
        legs.push(leg);
        if (leg.warning) warnings.push(leg.warning);
        continue;
      }

      const geometry = decodePolyline(valhallaLeg.shape, 6);
      if (geometry.length < 2) {
        if (request.strictLandRouting && !request.allowManualOverride) {
          throw new Error(
            `Routed geometry for leg ${index + 1} was incomplete. Enable manual override to force a direct segment.`
          );
        }

        const leg = fallbackLeg(from, to, index, "Decoded geometry was incomplete");
        legs.push(leg);
        if (leg.warning) warnings.push(leg.warning);
        continue;
      }

      const fallbackDistance = haversineMeters(from, to);
      legs.push({
        from,
        to,
        distanceMeters: (valhallaLeg.summary?.length ?? fallbackDistance / 1000) * 1000,
        durationSeconds: valhallaLeg.summary?.time ?? fallbackDistance / 1.35,
        geometry,
      });
    }

    return {
      orderedWaypoints: waypoints,
      legs,
      totalDistanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
      totalDurationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
      mode: "valhalla",
      routeMode: request.mode,
      bounds: computeBounds(waypoints),
      warnings,
    };
  }
}
