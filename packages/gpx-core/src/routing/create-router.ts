import type { Router } from "./router";
import { DirectRouter } from "./direct-router";
import { OsrmRouter } from "./osrm-router";

export function createRouterFromEnv(env: {
  ROUTER_MODE?: string;
  OSRM_URL?: string;
  OSRM_PROFILE?: string;
  OSRM_SNAP_RADIUS_METERS?: string;
  OSRM_MAX_PARALLEL_LEGS?: string;
}): Router {
  const mode = (env.ROUTER_MODE ?? "osrm").toLowerCase();

  if (mode === "osrm") {
    // Docker Compose DNS uses the service name (`osrm`). The container is named
    // `rogueroute-osrm` for logs/Dozzle, but app-to-OSRM traffic should use
    // http://osrm:5000 so it survives container-name changes.
    const osrmUrl = env.OSRM_URL?.trim() || "http://osrm:5000";

    const rawProfile = (env.OSRM_PROFILE ?? "foot").toLowerCase();
    const profile = rawProfile === "bike" || rawProfile === "car" ? rawProfile : "foot";
    const snapRadiusMeters = Number(env.OSRM_SNAP_RADIUS_METERS ?? "250");
    const maxParallelLegs = Number(env.OSRM_MAX_PARALLEL_LEGS ?? "6");

    return new OsrmRouter({
      baseUrl: osrmUrl,
      profile,
      snapRadiusMeters: Number.isFinite(snapRadiusMeters) ? snapRadiusMeters : 250,
      maxParallelLegs: Number.isFinite(maxParallelLegs) ? maxParallelLegs : 6,
    });
  }

  if (mode === "direct" || mode === "standard") {
    return new DirectRouter();
  }

  throw new Error(`Unsupported ROUTER_MODE: ${mode}. Supported values are osrm or direct.`);
}
