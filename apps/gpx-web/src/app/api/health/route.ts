import { NextResponse } from "next/server";
import { getStatus } from "../../../lib/control";

export const dynamic = "force-dynamic";

// Container health: the website answers. OSRM loading or switching a graph is not a container
// failure, so it is reported here but checked separately at /api/health/osrm.
export async function GET() {
  const osrm = await getStatus()
    .then((status) => ({ state: status.osrm.state, region: status.activeRegion, error: status.osrm.error }))
    .catch((error: Error) => ({ state: "unavailable", region: null, error: error.message }));
  return NextResponse.json(
    {
      ok: true,
      service: "rogueroute-gpx",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "v13.0.0",
      router: process.env.ROUTER_MODE ?? "osrm",
      osrmProfile: process.env.OSRM_PROFILE ?? "foot",
      osrm,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
