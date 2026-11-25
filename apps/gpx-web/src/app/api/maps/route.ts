import { errorResponse, getStatus, publicMaps, isAdmin } from "../../../lib/control";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(
      { ...publicMaps(await getStatus()), admin: isAdmin(request) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error, "Map status is unavailable.");
  }
}
