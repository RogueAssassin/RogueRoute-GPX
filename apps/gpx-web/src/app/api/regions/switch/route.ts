import { control, errorResponse, isAdmin, SWITCH_TIMEOUT_MS } from "../../../../lib/control";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const region = String(body.region ?? "").trim();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(region)) {
    return Response.json({ error: "Choose a region." }, { status: 400 });
  }
  try {
    // Public switches respect the cooldown; an administrator may skip it.
    const result = await control<{ region: string; switched: boolean }>(
      "POST",
      "/switch",
      { region, force: isAdmin(request) },
      SWITCH_TIMEOUT_MS,
    );
    return Response.json({ ok: true, activeRegion: result.region, switched: result.switched });
  } catch (error) {
    return errorResponse(error, "Failed to switch region.");
  }
}
