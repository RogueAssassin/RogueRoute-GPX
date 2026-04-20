import type { RoutePlan } from "../domain/route-plan";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildGpxFromTrack(points: [number, number][], name = "Generated Route"): string {
  const trkpts = points
    .map(([lat, lng]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
    .join("\n");

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
  const points: [number, number][] = [];

  for (const leg of plan.legs) {
    for (const point of leg.geometry) points.push(point);
  }

  return buildGpxFromTrack(points, name);
}
