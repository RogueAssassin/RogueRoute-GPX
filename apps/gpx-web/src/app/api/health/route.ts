import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "rogueroute-gpx",
    version: "10.0.0",
    router: process.env.ROUTER_MODE ?? "osrm",
    osrmProfile: process.env.OSRM_PROFILE ?? "foot",
    activeRegion: process.env.OSRM_ACTIVE_REGION ?? "australia",
    timestamp: new Date().toISOString(),
  });
}
