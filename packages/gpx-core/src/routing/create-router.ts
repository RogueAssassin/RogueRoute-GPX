import type { Router } from "./router";
import { DirectRouter } from "./direct-router";
import { OsrmRouter } from "./osrm-router";

export function createRouterFromEnv(env: {
  ROUTER_MODE?: string;
  OSRM_URL?: string;
  OSRM_PROFILE?: string;
  OSRM_SNAP_RADIUS_METERS?: string;
}): Router {
  const mode = (env.ROUTER_MODE ?? "osrm").toLowerCase();

  if (mode === "osrm") {
    if (!env.OSRM_URL) throw new Error("OSRM_URL is required when ROUTER_MODE=osrm");

    const rawProfile = (env.OSRM_PROFILE ?? "foot").toLowerCase();
    const profile = rawProfile === "bike" || rawProfile === "car" ? rawProfile : "foot";
    const snapRadiusMeters = Number(env.OSRM_SNAP_RADIUS_METERS ?? "150");

    return new OsrmRouter({
      baseUrl: env.OSRM_URL,
      profile,
      snapRadiusMeters: Number.isFinite(snapRadiusMeters) ? snapRadiusMeters : 150,
    });
  }

  if (mode === "direct" || mode === "standard") {
    return new DirectRouter();
  }

  throw new Error(`Unsupported ROUTER_MODE: ${mode}. Supported values are osrm or direct.`);
}
