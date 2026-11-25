import { control, errorResponse } from "../../../lib/control";
import type { IndexResponse } from "../../../lib/geofabrik";

export const dynamic = "force-dynamic";

/** Every downloadable Geofabrik region (names and parents, no outlines) and the prepared regions. */
export async function GET() {
  try {
    return Response.json(
      { ...(await control<IndexResponse>("GET", "/geofabrik")), adminEnabled: Boolean(process.env.ADMIN_TOKEN?.trim()) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error, "The region index is unavailable.");
  }
}
