import type { RoutePlan } from "../domain/route-plan";
import { flattenRoutePlanPoints } from "./simplify-track.js";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildGpxFromTrack(points: [number, number][], name = "Generated Route"): string {
  const lines: string[] = [];
  let previous: [number, number] | undefined;
  for (const [lat, lng] of points) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (previous && previous[0] === lat && previous[1] === lng) continue;
    lines.push(`      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}" />`);
    previous = [lat, lng];
  }
  const trkpts = lines.join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RogueRoute GPX by RogueAssassin"
  xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

export function buildGpxFromRoutePlan(plan: RoutePlan, name = "Generated Route"): string {
  return buildGpxFromTrack(flattenRoutePlanPoints(plan), name);
}
