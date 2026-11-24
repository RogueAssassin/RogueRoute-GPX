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
        maps: {
          current: status.queue.current?.region ?? null,
          step: status.queue.current?.step ?? null,
          pending: status.queue.pending.length,
        },
        adminEnabled: Boolean(process.env.ADMIN_TOKEN?.trim()),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error, "Region status is unavailable.");
  }
}
