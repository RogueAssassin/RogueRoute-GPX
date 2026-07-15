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

async function managerRequest(path: string, init?: RequestInit) {
  const url = process.env.OSRM_MANAGER_URL || "http://manager:9090";
  const token = process.env.OSRM_MANAGER_TOKEN;
  if (!token) throw new Error("OSRM manager token is not configured");
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(180_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `OSRM manager returned HTTP ${response.status}`);
  }
  return data;
}

export async function GET() {
  const switchEnabled = process.env.OSRM_SWITCH_ENABLED === "true";
  let manager: Record<string, unknown> = {};
  let managerError: string | undefined;
  if (switchEnabled) {
    try {
      manager = await managerRequest("/status");
    } catch (error) {
      managerError = error instanceof Error ? error.message : String(error);
    }
  }
  return Response.json({
    activeRegion:
      String(manager.activeRegion || "") ||
      process.env.OSRM_ACTIVE_REGION ||
      "australia",
    switchEnabled,
    managerReady: Boolean(manager.ok),
    managerError,
    graph: manager.graph,
    graphReady: manager.ready,
    regions: REGIONS,
  });
}

export async function POST(request: Request) {
  const switchEnabled = process.env.OSRM_SWITCH_ENABLED === "true";
  if (!switchEnabled) {
    return Response.json(
      { error: "OSRM region switching is disabled." },
      { status: 403 },
    );
  }

  const expectedKey = process.env.OSRM_SWITCH_ACCESS_KEY || "";
  const suppliedKey = request.headers.get("x-rogueroute-admin-key") || "";
  const expected = Buffer.from(expectedKey);
  const supplied = Buffer.from(suppliedKey);
  if (
    !expectedKey ||
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    return Response.json(
      { error: "A valid OSRM switch access key is required." },
      { status: 401 },
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

  const selected = REGIONS.find((item) => item.key === region)!;
  try {
    const result = await managerRequest("/switch", {
      method: "POST",
      body: JSON.stringify({
        region: selected.key,
        graph: selected.graph,
        pbf: selected.pbf,
      }),
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to switch OSRM region",
      },
      { status: 500 },
    );
  }
}
import { timingSafeEqual } from "node:crypto";
