import type { ExportPayload } from "../domain/export-payload";
import type { RawWaypoint } from "../domain/waypoint";

function parseDelimitedLine(line: string): RawWaypoint | null {
  const parts = line.split(/[,\s;]+/).filter(Boolean);
  if (parts.length < 2) return null;

  const lat = Number(parts[0]);
  const lng = Number(parts[1]);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export function parseWaypointsFromText(input: string): RawWaypoint[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parsed = parseDelimitedLine(line);
      if (!parsed) throw new Error(`Invalid coordinate on line ${index + 1}`);
      return parsed;
    });
}

export function parseWaypointsFromCsv(input: string): RawWaypoint[] {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const first = lines[0].toLowerCase();
  const hasHeader = first.includes("lat") && (first.includes("lng") || first.includes("lon"));
  const body = hasHeader ? lines.slice(1) : lines;

  return body.map((line, index) => {
    const parts = line.split(",").map((value) => value.trim());
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    const name = parts[2] || undefined;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new Error(`Invalid CSV coordinate on line ${index + 1 + (hasHeader ? 2 : 1)}`);
    }

    return { lat, lng, name };
  });
}

export function parseWaypointsFromJson(input: string): RawWaypoint[] {
  const data = JSON.parse(input);
  if (!Array.isArray(data)) throw new Error("JSON input must be an array of waypoint objects.");

  return data.map((item, index) => {
    const lat = Number(item.lat);
    const lng = Number(item.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new Error(`Invalid JSON coordinate at item ${index + 1}`);
    }

    return {
      lat,
      lng,
      name: typeof item.name === "string" ? item.name : undefined,
      id: typeof item.id === "string" ? item.id : undefined,
    };
  });
}

export function parseExportPayload(input: string): ExportPayload {
  const data = JSON.parse(input);
  if (!data || !Array.isArray(data.waypoints)) {
    throw new Error("Export payload must include a waypoints array.");
  }

  return {
    routeName: typeof data.routeName === "string" ? data.routeName : undefined,
    map:
      data.map &&
      Number.isFinite(Number(data.map.centerLat)) &&
      Number.isFinite(Number(data.map.centerLng)) &&
      Number.isFinite(Number(data.map.zoom))
        ? {
            centerLat: Number(data.map.centerLat),
            centerLng: Number(data.map.centerLng),
            zoom: Number(data.map.zoom),
          }
        : undefined,
    waypoints: data.waypoints.map((item: any, index: number) => {
      const lat = Number(item.lat);
      const lng = Number(item.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new Error(`Invalid export payload coordinate at item ${index + 1}`);
      }
      return {
        lat,
        lng,
        name: typeof item.name === "string" ? item.name : undefined,
        id: typeof item.id === "string" ? item.id : undefined,
      };
    }),
    source:
      data.source && typeof data.source.type === "string"
        ? {
            type: data.source.type,
            pluginVersion:
              typeof data.source.pluginVersion === "string"
                ? data.source.pluginVersion
                : undefined,
          }
        : undefined,
  };
}
