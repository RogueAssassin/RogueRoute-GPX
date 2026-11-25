import { control, errorResponse, isAdmin, unauthorized } from "../../../../lib/control";
import { GEOFABRIK_ID } from "../../../../lib/geofabrik";

export const dynamic = "force-dynamic";

const KEY = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Downloader actions for administrators:
 * add (a Geofabrik region to the list and the map queue), remove (an added region without
 * files), refresh (the Geofabrik region index).
 */
export async function POST(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  let payload: Record<string, unknown>;
  if (action === "add") {
    const id = String(body.id ?? "");
    if (!GEOFABRIK_ID.test(id)) return Response.json({ error: "Unknown region." }, { status: 400 });
    payload = { action, id, goal: body.goal === "downloaded" ? "downloaded" : "prepared", force: body.force === true };
  } else if (action === "remove") {
    const key = String(body.key ?? "");
    if (!KEY.test(key)) return Response.json({ error: "Unknown region." }, { status: 400 });
    payload = { action, key };
  } else if (action === "refresh") {
    payload = { action };
  } else {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }
  try {
    return Response.json(await control("POST", "/geofabrik", payload, 150_000));
  } catch (error) {
    return errorResponse(error, "The downloader action failed.");
  }
}
