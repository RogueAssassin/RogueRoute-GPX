import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "rogueroute-gpx",
    version: "5.0.0",
    timestamp: new Date().toISOString(),
  });
}
