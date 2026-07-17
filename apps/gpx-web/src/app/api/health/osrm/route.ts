import { NextResponse } from "next/server";

const TIMEOUT_MS = 4_000;

export async function GET() {
  const osrmUrl = (process.env.OSRM_URL || "http://osrm:5000").replace(/\/$/, "");
  const profile = process.env.OSRM_PROFILE || "foot";
  const startedAt = performance.now();

  try {
    // A nearest request confirms that osrm-routed loaded its graph and can
    // execute the configured API. NoSegment is healthy when 0,0 is outside
    // the active regional extract; transport and 5xx failures are not.
    const response = await fetch(
      `${osrmUrl}/nearest/v1/${encodeURIComponent(profile)}/0,0?number=1`,
      { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    const healthy = response.status < 500;
    return NextResponse.json(
      {
        ok: healthy,
        service: "rogueroute-gpx-osrm",
        status: response.status,
        latencyMs: Math.round(performance.now() - startedAt),
        profile,
        activeRegion: process.env.OSRM_ACTIVE_REGION ?? "australia",
        timestamp: new Date().toISOString(),
      },
      {
        status: healthy ? 200 : 503,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "rogueroute-gpx-osrm",
        latencyMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error && error.name === "TimeoutError" ? "OSRM readiness check timed out" : "OSRM is unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
