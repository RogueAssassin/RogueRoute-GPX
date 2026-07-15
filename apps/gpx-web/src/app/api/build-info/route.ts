import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function readText(path: string) {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return undefined;
  }
}

export async function GET() {
  const root = process.cwd();
  const packageJson = await readText(join(root, "package.json"));
  const parsedPackage = packageJson ? JSON.parse(packageJson) : {};
  const version =
    process.env.NEXT_PUBLIC_APP_VERSION ||
    parsedPackage.version ||
    "unknown";

  return Response.json({
    ok: true,
    app: process.env.NEXT_PUBLIC_APP_NAME || "RogueRoute-GPX",
    version,
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || "development",
    routerMode: process.env.ROUTER_MODE || "osrm",
    osrmUrl: process.env.OSRM_URL || "http://osrm:5000",
    osrmProfile: process.env.OSRM_PROFILE || "foot",
    osrmGraph: process.env.OSRM_GRAPH || "australia-latest.osrm",
    activeRegion: process.env.OSRM_ACTIVE_REGION || "australia",
    nodeEnv: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
}
