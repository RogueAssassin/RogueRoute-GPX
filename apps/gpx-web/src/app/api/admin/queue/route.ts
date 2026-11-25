import { control, errorResponse, getStatus, isAdmin, unauthorized, type QueueStatus } from "../../../../lib/control";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["add", "remove", "retry", "update", "pause", "resume", "cancel", "clear"]);

/** Full queue state for administrators: failures with reasons, disk, memory and the map log. */
export async function GET(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  try {
    const since = Number(new URL(request.url).searchParams.get("since")) || 0;
    const [status, { queue }] = await Promise.all([getStatus(), control<{ queue: QueueStatus }>("GET", `/queue?since=${since}`)]);
    return Response.json(
      { ok: true, queue, disk: status.disk, memory: status.memory, limits: status.limits },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error, "Queue status is unavailable.");
  }
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  if (!ACTIONS.has(action)) return Response.json({ error: "Unknown queue action." }, { status: 400 });
  const regions = Array.isArray(body.regions) ? body.regions.map(String).slice(0, 100) : undefined;
  const goal = body.goal === "downloaded" ? "downloaded" : "prepared";
  try {
    return Response.json(await control("POST", "/queue", { action, regions, goal, force: body.force === true }));
  } catch (error) {
    return errorResponse(error, "The queue action failed.");
  }
}
