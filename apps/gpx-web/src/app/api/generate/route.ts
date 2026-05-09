import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  generateRoute,
  parseExportPayload,
  parseWaypointsFromCsv,
  parseWaypointsFromJson,
  parseWaypointsFromText,
} from "@rogue/gpx-core";

const ROUTE_CACHE_LIMIT = Number(process.env.ROUTE_CACHE_LIMIT ?? "100");
const routeCache = new Map<string, unknown>();

function detectInputType(input: string): "payload" | "json" | "csv" | "text" {
  const trimmed = input.trim();

  if (trimmed.startsWith("{") && trimmed.includes("\"waypoints\"")) return "payload";
  if (trimmed.startsWith("[")) return "json";

  const firstLine = trimmed.split(/\r?\n/)[0]?.toLowerCase() ?? "";
  if (firstLine.includes("lat") && (firstLine.includes("lng") || firstLine.includes("lon"))) {
    return "csv";
  }

  return "text";
}

function cacheKey(value: unknown) {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

function getCached(key: string) {
  if (!routeCache.has(key)) return undefined;
  const value = routeCache.get(key);
  routeCache.delete(key);
  routeCache.set(key, value);
  return value;
}

function setCached(key: string, value: unknown) {
  routeCache.set(key, value);
  while (routeCache.size > ROUTE_CACHE_LIMIT) {
    const oldest = routeCache.keys().next().value;
    if (!oldest) break;
    routeCache.delete(oldest);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = String(body.input ?? "");
    const routeMode = body.routeMode ?? "optimize-middle";
    const name = body.name ?? "Generated Route";
    const strictLandRouting = body.strictLandRouting !== false;
    const allowFerries = body.allowFerries === true;
    const allowManualOverride = body.allowManualOverride === true;

    const inputType = detectInputType(input);
    const payload = inputType === "payload" ? parseExportPayload(input) : undefined;

    const rawWaypoints =
      inputType === "payload"
        ? payload!.waypoints
        : inputType === "json"
          ? parseWaypointsFromJson(input)
          : inputType === "csv"
            ? parseWaypointsFromCsv(input)
            : parseWaypointsFromText(input);

    const generationRequest = {
      rawWaypoints,
      request: {
        mode: routeMode,
        keepStartFixed: true,
        keepEndFixed: routeMode !== "loop",
        name: payload?.routeName ?? name,
        strictLandRouting,
        allowFerries,
        allowManualOverride,
      },
      env: {
        ROUTER_MODE: process.env.ROUTER_MODE,
        OSRM_URL: process.env.OSRM_URL,
        OSRM_PROFILE: process.env.OSRM_PROFILE,
        OSRM_SNAP_RADIUS_METERS: process.env.OSRM_SNAP_RADIUS_METERS,
        OSRM_MAX_PARALLEL_LEGS: process.env.OSRM_MAX_PARALLEL_LEGS,
      },
    };

    const key = cacheKey(generationRequest);
    const cached = getCached(key);
    if (cached) {
      return NextResponse.json({
        ...(cached as Record<string, unknown>),
        cache: "hit",
      });
    }

    const result = await generateRoute(generationRequest);
    const responsePayload = {
      ...result,
      cache: "miss",
      mapState: payload?.map,
      source: payload?.source,
      requestOptions: {
        strictLandRouting,
        allowFerries,
        allowManualOverride,
      },
    };
    setCached(key, responsePayload);

    return NextResponse.json(responsePayload);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate route.",
      },
      { status: 400 }
    );
  }
}
