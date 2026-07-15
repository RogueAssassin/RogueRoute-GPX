import { execFile } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const port = Number(process.env.OSRM_MANAGER_PORT || 9090);
const tokenFile = process.env.OSRM_MANAGER_TOKEN_FILE || "/run/rogueroute-secrets/manager-token";
let token = process.env.OSRM_MANAGER_TOKEN || "";
if (!token) {
  try {
    token = (await readFile(tokenFile, "utf8")).trim();
  } catch {
    token = "";
  }
}
const deploymentDir = process.env.DEPLOYMENT_DIR || "/deployment";
const dataDir = process.env.MANAGER_DATA_DIR || "/data";
const cooldownMs = Math.max(10, Number(process.env.OSRM_SWITCH_COOLDOWN_SECONDS || 60)) * 1000;
const envFile = join(deploymentDir, ".env");
const composeFile = join(deploymentDir, "compose.yaml");
let switching = false;
let lastSwitchAt = 0;

export function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    values[key] = rest.join("=");
  }
  return values;
}

export function updateEnvText(text, updates) {
  const pending = new Map(Object.entries(updates));
  const sourceLines = text.split(/\r?\n/);
  while (sourceLines.at(-1) === "") sourceLines.pop();
  const lines = sourceLines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match || !pending.has(match[1])) return line;
    const value = pending.get(match[1]);
    pending.delete(match[1]);
    return `${match[1]}=${value}`;
  });
  for (const [key, value] of pending) lines.push(`${key}=${value}`);
  return `${lines.join("\n")}\n`;
}

function safeBasename(value, suffix) {
  return typeof value === "string" &&
    /^[a-z0-9][a-z0-9-]*-latest\.(?:osm\.pbf|osrm)$/.test(value) &&
    value.endsWith(suffix);
}

async function graphStatus(graph) {
  const required = ["mldgr", "partition", "cell_metrics"];
  const missing = [];
  for (const suffix of required) {
    try {
      const file = await stat(join(dataDir, `${graph}.${suffix}`));
      if (!file.isFile() || file.size === 0) missing.push(`${graph}.${suffix}`);
    } catch {
      missing.push(`${graph}.${suffix}`);
    }
  }
  return { ready: missing.length === 0, missing };
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function send(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function statusResponse() {
  const text = await readFile(envFile, "utf8");
  const env = parseEnv(text);
  const graph = env.OSRM_GRAPH || "australia-latest.osrm";
  return {
    ok: true,
    activeRegion: env.OSRM_ACTIVE_REGION || "australia",
    graph,
    ...(await graphStatus(graph)),
    switching,
  };
}

async function switchRegion(payload) {
  const region = String(payload.region || "");
  const graph = String(payload.graph || "");
  const pbf = String(payload.pbf || "");
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(region)) throw new Error("Invalid region key");
  if (!safeBasename(graph, ".osrm") || !safeBasename(pbf, ".osm.pbf")) {
    throw new Error("Invalid graph or PBF filename");
  }
  const previous = await readFile(envFile, "utf8");
  const previousEnv = parseEnv(previous);
  if (previousEnv.OSRM_ACTIVE_REGION === region && previousEnv.OSRM_GRAPH === graph) {
    return { ok: true, activeRegion: region, graph, unchanged: true };
  }
  const remainingMs = cooldownMs - (Date.now() - lastSwitchAt);
  if (lastSwitchAt && remainingMs > 0) {
    throw new Error(`Region switching is cooling down. Try again in ${Math.ceil(remainingMs / 1000)} seconds.`);
  }

  const state = await graphStatus(graph);
  if (!state.ready) throw new Error(`Region is not prepared. Missing: ${state.missing.join(", ")}`);

  const next = updateEnvText(previous, {
    OSRM_ACTIVE_REGION: region,
    OSRM_GRAPH: graph,
    OSRM_PBF: pbf,
  });
  await writeFile(envFile, next, { mode: 0o600 });
  try {
    const result = await execFileAsync(
      "docker",
      ["compose", "--env-file", envFile, "-f", composeFile, "up", "-d", "--force-recreate", "osrm"],
      { timeout: 180_000, maxBuffer: 4 * 1024 * 1024 },
    );
    lastSwitchAt = Date.now();
    return { ok: true, activeRegion: region, graph, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    await writeFile(envFile, previous, { mode: 0o600 });
    throw new Error(`Docker failed; configuration was restored. ${error instanceof Error ? error.message : error}`);
  }
}

export function createManagerServer() {
  return createServer(async (request, response) => {
    try {
      if (request.url === "/health" && request.method === "GET") {
        send(response, 200, { ok: true, service: "rogueroute-osrm-manager" });
        return;
      }
      if (!token || request.headers.authorization !== `Bearer ${token}`) {
        send(response, 401, { error: "Unauthorized" });
        return;
      }
      if (request.url === "/status" && request.method === "GET") {
        send(response, 200, await statusResponse());
        return;
      }
      if (request.url === "/switch" && request.method === "POST") {
        if (switching) {
          send(response, 409, { error: "A region switch is already running" });
          return;
        }
        switching = true;
        try {
          send(response, 200, await switchRegion(await readBody(request)));
        } finally {
          switching = false;
        }
        return;
      }
      send(response, 404, { error: "Not found" });
    } catch (error) {
      send(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (!token) {
    console.error("OSRM_MANAGER_TOKEN is required");
    process.exit(1);
  }
  createManagerServer().listen(port, "0.0.0.0", () => {
    console.log(`RogueRoute OSRM manager listening on ${port}`);
  });
}
