import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REGIONS = [
  {
    key: "australia",
    label: "Australia",
    pbf: "australia-latest.osm.pbf",
    graph: "australia-latest.osrm",
    group: "core",
  },
  {
    key: "new-zealand",
    label: "New Zealand",
    pbf: "new-zealand-latest.osm.pbf",
    graph: "new-zealand-latest.osrm",
    group: "core",
  },
  {
    key: "japan",
    label: "Japan",
    pbf: "japan-latest.osm.pbf",
    graph: "japan-latest.osrm",
    group: "core",
  },
  {
    key: "china",
    label: "China",
    pbf: "china-latest.osm.pbf",
    graph: "china-latest.osrm",
    group: "core",
  },
  {
    key: "south-korea",
    label: "South Korea",
    pbf: "south-korea-latest.osm.pbf",
    graph: "south-korea-latest.osrm",
    group: "popular",
  },
  {
    key: "taiwan",
    label: "Taiwan",
    pbf: "taiwan-latest.osm.pbf",
    graph: "taiwan-latest.osrm",
    group: "popular",
  },
  {
    key: "singapore-malaysia-brunei",
    label: "Singapore/Malaysia/Brunei",
    pbf: "malaysia-singapore-brunei-latest.osm.pbf",
    graph: "malaysia-singapore-brunei-latest.osrm",
    group: "popular",
  },
  {
    key: "indonesia",
    label: "Indonesia",
    pbf: "indonesia-latest.osm.pbf",
    graph: "indonesia-latest.osrm",
    group: "popular",
  },
  {
    key: "india",
    label: "India",
    pbf: "india-latest.osm.pbf",
    graph: "india-latest.osrm",
    group: "popular",
  },
  {
    key: "us",
    label: "United States mainland",
    pbf: "us-latest.osm.pbf",
    graph: "us-latest.osrm",
    group: "core",
  },
  {
    key: "hawaii",
    label: "Hawaii",
    pbf: "hawaii-latest.osm.pbf",
    graph: "hawaii-latest.osrm",
    group: "core",
  },
  {
    key: "canada",
    label: "Canada",
    pbf: "canada-latest.osm.pbf",
    graph: "canada-latest.osrm",
    group: "popular",
  },
  {
    key: "mexico",
    label: "Mexico",
    pbf: "mexico-latest.osm.pbf",
    graph: "mexico-latest.osrm",
    group: "popular",
  },
  {
    key: "central-america",
    label: "Central America",
    pbf: "central-america-latest.osm.pbf",
    graph: "central-america-latest.osrm",
    group: "popular",
  },
  {
    key: "south-america",
    label: "South America",
    pbf: "south-america-latest.osm.pbf",
    graph: "south-america-latest.osrm",
    group: "popular",
  },
  {
    key: "europe",
    label: "Europe",
    pbf: "europe-latest.osm.pbf",
    graph: "europe-latest.osrm",
    group: "core",
  },
  {
    key: "uk-ireland",
    label: "UK and Ireland",
    pbf: "britain-and-ireland-latest.osm.pbf",
    graph: "britain-and-ireland-latest.osrm",
    group: "popular",
  },
  {
    key: "germany",
    label: "Germany",
    pbf: "germany-latest.osm.pbf",
    graph: "germany-latest.osrm",
    group: "popular",
  },
  {
    key: "france",
    label: "France",
    pbf: "france-latest.osm.pbf",
    graph: "france-latest.osrm",
    group: "popular",
  },
  {
    key: "spain",
    label: "Spain",
    pbf: "spain-latest.osm.pbf",
    graph: "spain-latest.osrm",
    group: "popular",
  },
  {
    key: "italy",
    label: "Italy",
    pbf: "italy-latest.osm.pbf",
    graph: "italy-latest.osrm",
    group: "popular",
  },
  {
    key: "netherlands",
    label: "Netherlands",
    pbf: "netherlands-latest.osm.pbf",
    graph: "netherlands-latest.osrm",
    group: "popular",
  },
];

async function readHostEnv() {
  const hostRoot = process.env.ROGUEROUTE_HOST_ROOT || "/host/rogueroute";
  const envFile = join(hostRoot, "infra", "docker", ".env");
  try {
    const text = await readFile(envFile, "utf8");
    const values: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
      const [key, ...rest] = line.split("=");
      values[key.trim()] = rest.join("=").trim();
    }
    return values;
  } catch {
    return {};
  }
}

export async function GET() {
  const hostEnv = await readHostEnv();
  return Response.json({
    activeRegion:
      hostEnv.OSRM_ACTIVE_REGION ||
      process.env.OSRM_ACTIVE_REGION ||
      "australia",
    switchEnabled: process.env.OSRM_SWITCH_ENABLED !== "false",
    regions: REGIONS,
  });
}

export async function POST(request: Request) {
  const switchEnabled = process.env.OSRM_SWITCH_ENABLED !== "false";
  if (!switchEnabled) {
    return Response.json(
      { error: "OSRM region switching is disabled." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const region = String(body.region || "").trim();
  if (!REGIONS.some((item) => item.key === region)) {
    return Response.json(
      { error: `Unknown OSRM region: ${region}` },
      { status: 400 },
    );
  }

  const script =
    process.env.OSRM_SWITCH_SCRIPT || "/host/rogueroute/switch-osrm-region.sh";
  try {
    const { stdout, stderr } = await execFileAsync(script, [region], {
      timeout: 180_000,
      maxBuffer: 1024 * 1024 * 4,
      cwd: process.env.ROGUEROUTE_HOST_ROOT || "/host/rogueroute",
    });
    return Response.json({ ok: true, activeRegion: region, stdout, stderr });
  } catch (error) {
    const err = error as { message?: string; stdout?: string; stderr?: string };
    return Response.json(
      {
        error: err.message || "Failed to switch OSRM region",
        stdout: err.stdout,
        stderr: err.stderr,
      },
      { status: 500 },
    );
  }
}
