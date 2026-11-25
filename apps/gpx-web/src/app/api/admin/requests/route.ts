import { control, errorResponse, isAdmin, unauthorized } from "../../../../lib/control";
import { GEOFABRIK_ID } from "../../../../lib/geofabrik";

export const dynamic = "force-dynamic";

/** Approve (add to the list and queue it) or dismiss a visitor's map request. */
export async function POST(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const action = String(body.action ?? "");
  if (!GEOFABRIK_ID.test(id) || !["approve", "dismiss"].includes(action)) return Response.json({ error: "Unknown request." }, { status: 400 });
  try {
    return Response.json(
      await control("POST", "/requests/resolve", { id, action, goal: body.goal === "downloaded" ? "downloaded" : "prepared", force: body.force === true }, 150_000),
    );
  } catch (error) {
    return errorResponse(error, "The request could not be updated.");
  }
}
