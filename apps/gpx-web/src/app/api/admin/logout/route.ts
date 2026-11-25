import { clearedSessionCookie, sameOrigin } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Log out from this site." }, { status: 403 });
  return Response.json({ ok: true }, { headers: { "set-cookie": clearedSessionCookie(request), "cache-control": "no-store" } });
}
