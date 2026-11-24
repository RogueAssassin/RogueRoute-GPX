import { getStatus } from "../../../lib/control";

export const dynamic = "force-dynamic";

export async function GET() {
  const supervisor = await getStatus().catch(() => null);
  return Response.json({
    ok: true,
    app: process.env.NEXT_PUBLIC_APP_NAME || "RogueRoute GPX",
    version: process.env.NEXT_PUBLIC_APP_VERSION || "development",
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || "development",
    routerMode: process.env.ROUTER_MODE || "osrm",
    osrmProfile: process.env.OSRM_PROFILE || "foot",
    activeRegion: supervisor?.activeRegion ?? "none",
    nodeEnv: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
}
