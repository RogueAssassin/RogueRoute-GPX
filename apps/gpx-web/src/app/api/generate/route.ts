import { NextResponse } from "next/server";
import {
  generateRoute,
  parseExportPayload,
  parseWaypointsFromCsv,
  parseWaypointsFromJson,
  parseWaypointsFromText,
} from "@rogue/gpx-core";

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

    const result = await generateRoute({
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
      },
    });

    return NextResponse.json({
      ...result,
      mapState: payload?.map,
      source: payload?.source,
      requestOptions: {
        strictLandRouting,
        allowFerries,
        allowManualOverride,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate route.",
      },
      { status: 400 }
    );
  }
}
