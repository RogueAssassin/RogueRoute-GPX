import { control, errorResponse, isAdmin, unauthorized } from "../../../../lib/control";

export const dynamic = "force-dynamic";

const KEY = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Delete a region's map files; removeFromList also takes an added region off the list. */
export async function POST(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const key = String(body.key ?? "");
  if (!KEY.test(key)) return Response.json({ error: "Unknown region." }, { status: 400 });
  try {
    return Response.json(await control("POST", "/files", { action: "delete", key, removeFromList: body.removeFromList === true }, 60_000));
  } catch (error) {
    return errorResponse(error, "The files could not be deleted.");
  }
}
