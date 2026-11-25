import { control, errorResponse, isAdmin, unauthorized } from "../../../../lib/control";

export const dynamic = "force-dynamic";

/** Ask Geofabrik now whether downloaded regions have newer data. */
export async function POST(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  try {
    return Response.json(await control("POST", "/updates", { action: "check" }, 600_000));
  } catch (error) {
    return errorResponse(error, "The update check failed.");
  }
}
