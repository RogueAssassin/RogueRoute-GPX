import { adminEnabled, checkPassword, clientKey, createSession, loginDelay, recordLoginFailure, sameOrigin, sessionCookie } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

/** Log in to /admin with ADMIN_PASSWORD; sets the session cookie. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Log in from this site." }, { status: 403 });
  if (!adminEnabled()) {
    return Response.json({ error: "Administration is disabled. Set ADMIN_PASSWORD in .env and restart." }, { status: 503 });
  }
  const key = clientKey(request);
  const wait = loginDelay(key);
  if (wait) {
    return Response.json({ error: `Too many failed attempts. Try again in ${wait} seconds.` }, { status: 429, headers: { "retry-after": String(wait) } });
  }
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password.slice(0, 1024) : "";
  if (!checkPassword(password)) {
    recordLoginFailure(key);
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { "set-cookie": sessionCookie(request, createSession()), "cache-control": "no-store" } });
}
