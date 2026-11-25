import { control, errorResponse, getStatus, isAdmin, unauthorized, type QueueStatus } from "../../../../lib/control";
import type { MapRequest } from "../../../../lib/admin";

export const dynamic = "force-dynamic";

/** Everything the admin page shows: regions with update state, the queue and its log, requests. */
export async function GET(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  try {
    const since = Number(new URL(request.url).searchParams.get("since")) || 0;
    const [status, { queue }, { requests }] = await Promise.all([
      getStatus(),
      control<{ queue: QueueStatus }>("GET", `/queue?since=${since}`),
      control<{ requests: MapRequest[] }>("GET", "/requests"),
    ]);
    return Response.json({ ...status, queue, requests }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Map status is unavailable.");
  }
}
