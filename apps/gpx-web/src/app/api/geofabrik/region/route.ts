import { control, errorResponse } from "../../../../lib/control";
import { GEOFABRIK_ID, type RegionDetail } from "../../../../lib/geofabrik";

export const dynamic = "force-dynamic";

/** One region in detail: outline, sub-regions, download size, memory estimate and coverage. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!GEOFABRIK_ID.test(id)) return Response.json({ error: "Unknown region." }, { status: 400 });
  try {
    return Response.json(await control<RegionDetail>("GET", `/geofabrik/region?id=${encodeURIComponent(id)}`, undefined, 30_000), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error, "Region details are unavailable.");
  }
}
