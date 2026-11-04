import { control, errorResponse, isAdmin, type JobStatus } from "../../../../lib/control";

export const dynamic = "force-dynamic";

const unauthorized = () =>
  Response.json(
    { error: process.env.ADMIN_TOKEN?.trim() ? "Admin token required." : "Map administration is disabled. Set ADMIN_TOKEN in .env." },
    { status: 401 },
  );

export async function GET(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  try {
    return Response.json(await control<{ job: JobStatus | null }>("GET", "/jobs"), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Job status is unavailable.");
  }
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const type = body.type === "download" || body.type === "prepare" ? body.type : null;
  const regions = Array.isArray(body.regions) ? body.regions.map(String) : [];
  if (!type || regions.length === 0) {
    return Response.json({ error: "Give a job type (download or prepare) and at least one region." }, { status: 400 });
  }
  try {
    return Response.json(await control("POST", "/jobs", { type, regions }), { status: 202 });
  } catch (error) {
    return errorResponse(error, "Failed to start the job.");
  }
}
