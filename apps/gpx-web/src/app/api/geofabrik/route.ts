import { control, errorResponse, isAdmin } from "../../../lib/control";
import type { IndexResponse } from "../../../lib/geofabrik";

export const dynamic = "force-dynamic";

/** Every downloadable Geofabrik region (names and parents, no outlines) and the prepared regions. */
export async function GET(request: Request) {
  try {
    return Response.json(
      { ...(await control<IndexResponse>("GET", "/geofabrik")), admin: isAdmin(request) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error, "The region index is unavailable.");
  }
}
