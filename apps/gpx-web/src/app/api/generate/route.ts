import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  generateRoute,
  parseExportPayload,
  parseWaypointsFromCsv,
  parseWaypointsFromJson,
  parseWaypointsFromText,
  OsrmRoutingError,
  normalizeWaypoints,
  resolveRegion,
} from "@rogueroute-gpx/core";
import { control, ControlError, getStatus, SWITCH_TIMEOUT_MS } from "../../../lib/control";

type RegionChoice = { key: string; label: string; switched: boolean } | null;

/**
 * Make sure OSRM serves a graph that covers the waypoints: the requested region, or on
 * "auto" the region found from the coordinates. Switches the graph when needed.
 * Returns null when no supervisor is running (local development against a plain OSRM).
 */
async function ensureRegion(points: { lat: number; lng: number }[], requested: string): Promise<RegionChoice> {
  if ((process.env.ROUTER_MODE ?? "osrm").toLowerCase() !== "osrm") return null;
  const status = await getStatus().catch((error) => {
    if (error instanceof ControlError && error.code === "unavailable") return null;
    throw error;
  });
  if (!status) return null;

  const candidates = status.regions.map((region) => ({
    key: region.key,
    label: region.label,
    bounds: region.bounds,
    prepared: region.state === "prepared",
  }));
  let target: { key: string; label: string; prepared: boolean } | undefined;
  if (requested && requested !== "auto") {
    target = candidates.find((region) => region.key === requested);
    if (!target) throw new Error(`Unknown region: ${requested}`);
    if (!target.prepared) throw new Error(`${target.label} is not prepared on this server.`);
  } else {
    const resolution = resolveRegion(points, candidates, status.activeRegion ?? undefined);
    if (!resolution.ok) throw new Error(resolution.message);
    target = resolution.region;
  }

  if (target.key === status.activeRegion && status.osrm.state === "ready") {
    return { key: target.key, label: target.label, switched: false };
  }
  const result = await control<{ region: string; switched: boolean }>("POST", "/switch", { region: target.key }, SWITCH_TIMEOUT_MS);
  return { key: target.key, label: target.label, switched: result.switched };
}

const configuredCacheLimit = Number(process.env.ROUTE_CACHE_LIMIT ?? "100");
const ROUTE_CACHE_LIMIT = Number.isFinite(configuredCacheLimit)
  ? Math.max(1, Math.min(500, Math.floor(configuredCacheLimit)))
  : 100;
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
  let previewWaypoints: ReturnType<typeof normalizeWaypoints> = [];
  try {
    const body = await request.json();
    const input = String(body.input ?? "");
    const routeMode = body.routeMode ?? "optimize-middle";
    const name = body.name ?? "Generated Route";
    const strictLandRouting = body.strictLandRouting !== false;
    const allowFerries = body.allowFerries === true;
    const allowManualOverride = body.allowManualOverride === true;
    const geometryDetail =
      body.geometryDetail === "compact" || body.geometryDetail === "full"
        ? body.geometryDetail
        : "auto";

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
    previewWaypoints = normalizeWaypoints(rawWaypoints);
    const region = await ensureRegion(previewWaypoints, String(body.region ?? "auto"));

    const generationRequest = {
      region: region?.key ?? null,
      rawWaypoints,
      request: {
        mode: routeMode,
        keepStartFixed: true,
        keepEndFixed: routeMode !== "loop",
        name: payload?.routeName ?? name,
        strictLandRouting,
        allowFerries,
        allowManualOverride,
        geometryDetail,
      },
      env: {
        ROUTER_MODE: process.env.ROUTER_MODE,
        OSRM_URL: process.env.OSRM_URL,
        OSRM_PROFILE: process.env.OSRM_PROFILE,
        OSRM_SNAP_RADIUS_METERS: process.env.OSRM_SNAP_RADIUS_METERS,
        OSRM_SNAP_MAX_RADIUS_METERS:
          process.env.OSRM_SNAP_MAX_RADIUS_METERS,
        OSRM_MAX_PARALLEL_LEGS: process.env.OSRM_MAX_PARALLEL_LEGS,
        GPX_MAX_TRACK_POINTS: process.env.GPX_MAX_TRACK_POINTS,
        GPX_SIMPLIFY_TOLERANCE_METERS:
          process.env.GPX_SIMPLIFY_TOLERANCE_METERS,
      },
    };

    const key = cacheKey(generationRequest);
    const cached = getCached(key);
    if (cached) {
      return NextResponse.json({
        ...(cached as Record<string, unknown>),
        cache: "hit",
        region,
      });
    }

    const result = await generateRoute(generationRequest);
    const responsePayload = {
      ...result,
      cache: "miss",
      region,
      mapState: payload?.map,
      source: payload?.source,
      requestOptions: {
        strictLandRouting,
        allowFerries,
        allowManualOverride,
        geometryDetail,
      },
    };
    setCached(key, responsePayload);

    return NextResponse.json(responsePayload);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate route.",
        routingFailure:
          error instanceof OsrmRoutingError ? error.routingFailure : undefined,
        previewWaypoints,
      },
      { status: 400 }
    );
  }
}
