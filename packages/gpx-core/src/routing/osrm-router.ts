import type { RoutePlan, RouteLeg } from "../domain/route-plan";
import type { RouteRequest } from "../domain/route-options";
import type { Waypoint } from "../domain/waypoint";
import type { Router } from "./router";
import { computeBounds, haversineMeters } from "../utils/geo";

type OsrmConfig = {
  baseUrl: string;
  profile?: "foot" | "bike" | "car";
  snapRadiusMeters?: number;
};

type OsrmRouteResponse = {
  code?: string;
  message?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      type?: "LineString";
      coordinates?: Array<[number, number]>;
    };
  }>;
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

function osrmProfile(profile: OsrmConfig["profile"]): string {
  if (profile === "bike") return "bike";
  if (profile === "car") return "car";
  return "foot";
}

export class OsrmRouter implements Router {
  private readonly baseUrl: string;
  private readonly profile: "foot" | "bike" | "car";
  private readonly snapRadiusMeters: number;

  constructor(config: OsrmConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.profile = config.profile ?? "foot";
    this.snapRadiusMeters = config.snapRadiusMeters ?? 150;
  }

  async route(waypoints: Waypoint[], request: RouteRequest): Promise<RoutePlan> {
    const legs: RouteLeg[] = [];
    const warnings: string[] = [];
    const profile = osrmProfile(this.profile);

    for (let index = 0; index < waypoints.length - 1; index += 1) {
      const from = waypoints[index];
      const to = waypoints[index + 1];
      const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
      const radiuses = `${this.snapRadiusMeters};${this.snapRadiusMeters}`;
      const params = new URLSearchParams({
        overview: "full",
        geometries: "geojson",
        steps: "false",
        alternatives: "false",
        continue_straight: "false",
        radiuses,
      });

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/route/v1/${profile}/${coords}?${params.toString()}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "OSRM request failed";
        if (request.allowManualOverride) {
          const leg = fallbackLeg(from, to, index, reason);
          legs.push(leg);
          if (leg.warning) warnings.push(leg.warning);
          continue;
        }
        throw new Error(`OSRM routing request failed on leg ${index + 1}: ${reason}`);
      }

      if (!response.ok) {
        const body = await response.text();
        const reason = `OSRM routing failed on leg ${index + 1}: ${response.status} ${body}`;
        if (request.allowManualOverride) {
          const leg = fallbackLeg(from, to, index, reason);
          legs.push(leg);
          if (leg.warning) warnings.push(leg.warning);
          continue;
        }
        throw new Error(reason);
      }

      const data = (await response.json()) as OsrmRouteResponse;
      const route = data.routes?.[0];
      const geometry = route?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng] as [number, number]) ?? [];

      if (data.code !== "Ok" || geometry.length < 2) {
        const reason = data.message || `No routed OSRM geometry was returned for leg ${index + 1}.`;
        if (request.strictLandRouting && !request.allowManualOverride) {
          throw new Error(`${reason} Try a closer waypoint, a larger OSRM extract, or enable manual override.`);
        }
        const leg = fallbackLeg(from, to, index, reason);
        legs.push(leg);
        if (leg.warning) warnings.push(leg.warning);
        continue;
      }

      const fallbackDistance = haversineMeters(from, to);
      legs.push({
        from,
        to,
        distanceMeters: route?.distance ?? fallbackDistance,
        durationSeconds: route?.duration ?? fallbackDistance / 1.35,
        geometry,
      });
    }

    return {
      orderedWaypoints: waypoints,
      legs,
      totalDistanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
      totalDurationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
      mode: "osrm",
      routeMode: request.mode,
      bounds: computeBounds(waypoints),
      warnings,
    };
  }
}
