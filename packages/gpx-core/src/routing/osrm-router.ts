import type { RoutePlan, RouteLeg } from "../domain/route-plan";
import type { RouteRequest } from "../domain/route-options";
import type { Waypoint } from "../domain/waypoint";
import type { Router } from "./router";
import { computeBounds, haversineMeters } from "../utils/geo";

type OsrmConfig = {
  baseUrl: string;
  profile?: "foot" | "bike" | "car";
  snapRadiusMeters?: number;
  maxParallelLegs?: number;
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

type OsrmNearestResponse = {
  code?: string;
  message?: string;
  waypoints?: Array<{
    name?: string;
    distance?: number;
    location?: [number, number];
  }>;
};

type SnappedWaypoint = Waypoint & {
  snapDistanceMeters?: number;
  originalLat?: number;
  originalLng?: number;
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

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "Unknown OSRM error");
}

function snapWarning(point: SnappedWaypoint, label: string, index: number): string | undefined {
  if (!Number.isFinite(point.snapDistanceMeters) || !point.snapDistanceMeters) return undefined;
  return `Leg ${index + 1}: ${label} waypoint auto-snapped ${Math.round(point.snapDistanceMeters)}m to the nearest OSRM path.`;
}

export class OsrmRouter implements Router {
  private readonly baseUrl: string;
  private readonly profile: "foot" | "bike" | "car";
  private readonly snapRadiusMeters: number;
  private readonly maxParallelLegs: number;

  constructor(config: OsrmConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.profile = config.profile ?? "foot";
    this.snapRadiusMeters = Math.max(25, config.snapRadiusMeters ?? 250);
    this.maxParallelLegs = Math.max(1, config.maxParallelLegs ?? 6);
  }

  private async snap(point: Waypoint, label: string): Promise<SnappedWaypoint> {
    const profile = osrmProfile(this.profile);
    const params = new URLSearchParams({
      number: "1",
      radiuses: String(this.snapRadiusMeters),
      generate_hints: "false",
    });
    const url = `${this.baseUrl}/nearest/v1/${profile}/${point.lng},${point.lat}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`${label} waypoint could not be snapped by OSRM: ${response.status} ${body}`.trim());
    }
    const data = (await response.json()) as OsrmNearestResponse;
    const nearest = data.waypoints?.[0];
    const location = nearest?.location;
    if (data.code !== "Ok" || !location) {
      throw new Error(`${label} waypoint has no routable OSRM segment within ${this.snapRadiusMeters}m (${data.message || data.code || "NoSegment"}).`);
    }
    const [lng, lat] = location;
    return {
      ...point,
      lat,
      lng,
      originalLat: point.lat,
      originalLng: point.lng,
      snapDistanceMeters: nearest.distance ?? haversineMeters(point, { ...point, lat, lng }),
    };
  }

  private async fetchLeg(from: Waypoint, to: Waypoint, index: number, overview: "full" | "simplified" = "full") {
    const profile = osrmProfile(this.profile);
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const radiuses = `${this.snapRadiusMeters};${this.snapRadiusMeters}`;
    const params = new URLSearchParams({
      overview,
      geometries: "geojson",
      steps: "false",
      alternatives: "false",
      continue_straight: "false",
      radiuses,
    });

    const response = await fetch(`${this.baseUrl}/route/v1/${profile}/${coords}?${params.toString()}`);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OSRM routing failed on leg ${index + 1}: ${response.status} ${body}`.trim());
    }

    const data = (await response.json()) as OsrmRouteResponse;
    const route = data.routes?.[0];
    const geometry = route?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng] as [number, number]) ?? [];
    if (data.code !== "Ok" || geometry.length < 2) {
      throw new Error(`OSRM routing failed on leg ${index + 1}: ${data.message || data.code || "No routed geometry was returned."}`);
    }
    return { route, geometry };
  }

  private async routeLeg(from: Waypoint, to: Waypoint, index: number, request: RouteRequest): Promise<{ leg: RouteLeg; warnings: string[] }> {
    const warnings: string[] = [];
    try {
      const { route, geometry } = await this.fetchLeg(from, to, index);
      const fallbackDistance = haversineMeters(from, to);
      return {
        leg: {
          from,
          to,
          distanceMeters: route?.distance ?? fallbackDistance,
          durationSeconds: route?.duration ?? fallbackDistance / 1.35,
          geometry,
        },
        warnings,
      };
    } catch (firstError) {
      const firstReason = asErrorMessage(firstError);
      try {
        const snappedFrom = await this.snap(from, "Start");
        const snappedTo = await this.snap(to, "End");
        const fromWarning = snapWarning(snappedFrom, "start", index);
        const toWarning = snapWarning(snappedTo, "end", index);
        if (fromWarning) warnings.push(fromWarning);
        if (toWarning) warnings.push(toWarning);
        const { route, geometry } = await this.fetchLeg(snappedFrom, snappedTo, index);
        const fallbackDistance = haversineMeters(snappedFrom, snappedTo);
        return {
          leg: {
            from,
            to,
            distanceMeters: route?.distance ?? fallbackDistance,
            durationSeconds: route?.duration ?? fallbackDistance / 1.35,
            geometry,
            warning: warnings.join(" ") || undefined,
          },
          warnings,
        };
      } catch (snapError) {
        const retryReason = asErrorMessage(snapError);
        const reason = `${firstReason}; nearest retry failed: ${retryReason}`;
        if (request.allowManualOverride) {
          const leg = fallbackLeg(from, to, index, reason);
          return { leg, warnings: [...warnings, leg.warning! ] };
        }
        throw new Error(`${reason}. Try moving waypoint ${index + 1}/${index + 2} closer to a visible road/path, increase OSRM_SNAP_RADIUS_METERS, or enable Manual override.`);
      }
    }
  }

  async route(waypoints: Waypoint[], request: RouteRequest): Promise<RoutePlan> {
    const legs: RouteLeg[] = new Array(Math.max(0, waypoints.length - 1));
    const warnings: string[] = [];

    for (let start = 0; start < waypoints.length - 1; start += this.maxParallelLegs) {
      const batch = [];
      for (let index = start; index < Math.min(waypoints.length - 1, start + this.maxParallelLegs); index += 1) {
        batch.push(this.routeLeg(waypoints[index], waypoints[index + 1], index, request));
      }
      const settled = await Promise.allSettled(batch);
      for (let offset = 0; offset < settled.length; offset += 1) {
        const index = start + offset;
        const item = settled[offset];
        if (item.status === "fulfilled") {
          legs[index] = item.value.leg;
          warnings.push(...item.value.warnings);
        } else {
          throw item.reason instanceof Error ? item.reason : new Error(String(item.reason));
        }
      }
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
