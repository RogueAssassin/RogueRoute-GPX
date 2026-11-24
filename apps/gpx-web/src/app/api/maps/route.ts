import { errorResponse, getStatus, publicMaps } from "../../../lib/control";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(
      { ...publicMaps(await getStatus()), adminEnabled: Boolean(process.env.ADMIN_TOKEN?.trim()) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error, "Map status is unavailable.");
  }
}
