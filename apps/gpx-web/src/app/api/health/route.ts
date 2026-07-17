import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "rogueroute-gpx-web",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "v12.5.1",
      router: process.env.ROUTER_MODE ?? "osrm",
      osrmProfile: process.env.OSRM_PROFILE ?? "foot",
      activeRegion: process.env.OSRM_ACTIVE_REGION ?? "australia",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
