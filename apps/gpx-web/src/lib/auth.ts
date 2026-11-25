import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Admin login for /admin: one fixed password (ADMIN_PASSWORD in .env) and a signed session
 * cookie. The signing key is random per container start, so a restart logs everyone out, and
 * the password is part of the signature, so changing it does too.
 */
export const SESSION_COOKIE = "rrg_admin";
const SESSION_SECONDS = 12 * 3600;
const FAILURES_PER_MINUTE = 5;
const GLOBAL_FAILURES_PER_MINUTE = 30;

type AuthStore = { secret: Buffer; failures: Map<string, { count: number; resetAt: number }> };
const globalStore = globalThis as typeof globalThis & { __rogueRouteAuth?: AuthStore };
const store: AuthStore = (globalStore.__rogueRouteAuth ??= { secret: randomBytes(32), failures: new Map() });

/** The configured password; ADMIN_TOKEN from v13.4 and earlier still works until it is renamed. */
export function adminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || process.env.ADMIN_TOKEN?.trim() || "";
}

export const adminEnabled = () => adminPassword().length > 0;

const digest = (value: string) => createHash("sha256").update(value).digest();

function sign(payload: string) {
  return createHmac("sha256", store.secret).update(payload).update("\0").update(digest(adminPassword())).digest("base64url");
}

function safeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Timing-safe comparison with the configured password. */
export function checkPassword(supplied: string) {
  const expected = adminPassword();
  return Boolean(expected) && safeEqual(digest(supplied), digest(expected));
}

export function createSession() {
  const payload = `v1.${Date.now() + SESSION_SECONDS * 1000}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string | null | undefined) {
  if (!token || !adminEnabled()) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  if (!safeEqual(Buffer.from(token.slice(dot + 1)), Buffer.from(sign(payload)))) return false;
  const [version, expires] = payload.split(".");
  return version === "v1" && Number(expires) > Date.now();
}

function readCookie(header: string | null, name: string) {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

/** A browser request from another site carries a different Origin; refuse those for changes. */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // not sent by browsers for same-origin GETs, nor by curl
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** True for a request with a valid admin session (and, for changes, from this site). */
export function isAdminRequest(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD" && !sameOrigin(request)) return false;
  return verifySession(readCookie(request.headers.get("cookie"), SESSION_COOKIE));
}

/** Session check for server components (the /admin page). */
export async function isAdminSession() {
  const { cookies } = await import("next/headers");
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

const secure = (request: Request) =>
  new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";

export function sessionCookie(request: Request, token: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure(request) ? "; Secure" : ""}`;
}

export function clearedSessionCookie(request: Request) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure(request) ? "; Secure" : ""}`;
}

/** The visitor's address as seen by the website (the first X-Forwarded-For hop behind a proxy). */
export function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "direct";
}

function bucket(key: string) {
  const now = Date.now();
  let entry = store.failures.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + 60_000 };
    store.failures.set(key, entry);
  }
  if (store.failures.size > 10_000) {
    for (const [name, value] of store.failures) if (value.resetAt <= now) store.failures.delete(name);
  }
  return entry;
}

/** Seconds to wait before another login attempt from this address, or 0. */
export function loginDelay(key: string) {
  const own = bucket(`ip:${key}`);
  const all = bucket("all");
  const blocked = [own.count >= FAILURES_PER_MINUTE && own, all.count >= GLOBAL_FAILURES_PER_MINUTE && all].filter(Boolean) as { resetAt: number }[];
  return blocked.length ? Math.ceil((Math.max(...blocked.map((entry) => entry.resetAt)) - Date.now()) / 1000) : 0;
}

export function recordLoginFailure(key: string) {
  bucket(`ip:${key}`).count++;
  bucket("all").count++;
}

/**
 * A simple per-address limit for public actions (map requests): at most `limit` per window.
 * Returns false when the address is over it.
 */
export function allowAction(name: string, key: string, limit: number, windowMs: number) {
  const id = `${name}:${key}`;
  const now = Date.now();
  let entry = store.failures.get(id);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.failures.set(id, entry);
  }
  entry.count++;
  return entry.count <= limit;
}
