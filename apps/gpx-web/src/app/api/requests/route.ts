import { allowAction, clientKey, sameOrigin } from "../../../lib/auth";
import { control, errorResponse } from "../../../lib/control";
import { GEOFABRIK_ID } from "../../../lib/geofabrik";

export const dynamic = "force-dynamic";

/** A visitor asks for a map region; an administrator approves it at /admin. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request maps from this site." }, { status: 403 });
  if (!allowAction("request", clientKey(request), 10, 3_600_000)) {
    return Response.json({ error: "You have sent a lot of map requests. Try again later." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!GEOFABRIK_ID.test(id)) return Response.json({ error: "Unknown region." }, { status: 400 });
  try {
    return Response.json(await control("POST", "/requests", { id, note: typeof body.note === "string" ? body.note.slice(0, 500) : "" }));
  } catch (error) {
    return errorResponse(error, "The request could not be saved.");
  }
}
