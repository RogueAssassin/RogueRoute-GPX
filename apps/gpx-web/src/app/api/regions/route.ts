import { errorResponse, getStatus, publicRegions } from "../../../lib/control";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getStatus();
    return Response.json(
      {
        ok: true,
        activeRegion: status.activeRegion,
        osrm: status.osrm,
        regions: publicRegions(status),
        adminEnabled: Boolean(process.env.ADMIN_TOKEN?.trim()),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error, "Region status is unavailable.");
  }
}
