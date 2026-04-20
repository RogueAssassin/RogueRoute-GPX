import type { Router } from "./router";
import { DirectRouter } from "./direct-router";
import { ValhallaRouter } from "./valhalla-router";

export function createRouterFromEnv(env: {
  ROUTER_MODE?: string;
  VALHALLA_URL?: string;
}): Router {
  const mode = (env.ROUTER_MODE ?? "direct").toLowerCase();

  if (mode === "valhalla") {
    if (!env.VALHALLA_URL) throw new Error("VALHALLA_URL is required when ROUTER_MODE=valhalla");

    return new ValhallaRouter({
      baseUrl: env.VALHALLA_URL,
      costing: "pedestrian",
    });
  }

  return new DirectRouter();
}
