#!/usr/bin/env node
// rogueroute-gpx supervisor: PID 1 of the single container. Runs the web server and
// osrm-routed as child processes, switches regions by restarting osrm-routed on another
// graph, and runs the background map queue (download and prepare). No container engine
// access is needed.
import { spawn } from "node:child_process";
import { loadCatalog } from "./catalog.mjs";
import { startControlServer } from "./control.mjs";
import { GeofabrikIndex } from "./geofabrik.mjs";
import { OsrmService } from "./osrm.mjs";
import { MapQueue, parseSize } from "./queue.mjs";
import { MapRequests } from "./requests.mjs";
import { UpdateChecker } from "./updates.mjs";

const env = process.env;
const number = (value, fallback, min = 0) => {
  if (value === undefined || String(value).trim() === "") return fallback; // empty .env value: default
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
};

const config = {
  catalogFile: env.ROGUEROUTE_REGIONS_FILE || "/app/regions.json",
  dataDir: env.ROGUEROUTE_DATA_DIR || "/data",
  binDir: env.OSRM_BIN_DIR || "/usr/local/bin",
  profilesDir: env.OSRM_PROFILES_DIR || "/opt",
  profile: (env.OSRM_PROFILE || "foot").toLowerCase(),
  osrmPort: number(env.OSRM_PORT, 5000, 1),
  webPort: number(env.PORT, 9080, 1),
  webEntry: env.ROGUEROUTE_WEB_ENTRY || "/app/apps/gpx-web/server.js",
  socketPath: env.ROGUEROUTE_CONTROL_SOCKET || "/tmp/rogueroute-gpx.sock",
  startupTimeoutMs: number(env.ROGUEROUTE_STARTUP_TIMEOUT_SECONDS, 600, 30) * 1000,
  cooldownMs: number(env.OSRM_SWITCH_COOLDOWN_SECONDS, 60, 0) * 1000,
  initialRegion: env.OSRM_REGION || env.OSRM_ACTIVE_REGION || "",
  autoPrepare: !/^(0|false|no|off)$/i.test(env.ROGUEROUTE_AUTO_PREPARE || "true"),
  threads: number(env.ROGUEROUTE_PREPARE_THREADS, 0, 0),
  niceness: Math.min(19, number(env.ROGUEROUTE_PREPARE_NICE, 10, 0)),
  // ROGUEROUTE_MEMORY_CAP is the cap ./rogueroute-gpx resolved from ROGUEROUTE_MEMORY_LIMIT.
  memoryCap: parseSize(env.ROGUEROUTE_MEMORY_CAP),
  memoryFloor: parseSize(env.ROGUEROUTE_MEMORY_FLOOR),
  ioIdle: !/^(0|false|no|off)$/i.test(env.ROGUEROUTE_PREPARE_IDLE_IO || "true"),
  geofabrikUrl: env.ROGUEROUTE_GEOFABRIK_INDEX_URL || undefined,
  // How often to ask Geofabrik for newer data (0 = never), and the age after which it is fetched automatically (0 = report only).
  updateCheckDays: number(env.ROGUEROUTE_UPDATE_CHECK_DAYS, 7, 0),
  autoUpdateDays: number(env.ROGUEROUTE_AUTO_UPDATE_DAYS, 30, 0),
};

const log = (line) => console.log(`${new Date().toISOString()} ${line}`);

const catalog = await loadCatalog(config.catalogFile);
// Regions added from the downloader page come after the built-in ones.
for (const region of await GeofabrikIndex.loadAdded(config.dataDir)) {
  if (catalog.some((entry) => entry.key === region.key)) continue;
  catalog.push({ ...region, pbf: `${region.graph}-latest.osm.pbf`, osrm: `${region.graph}-latest.osrm` });
}
const geofabrik = new GeofabrikIndex({ dataDir: config.dataDir, catalog, log, url: config.geofabrikUrl });
geofabrik.init().catch((error) => log(`[maps] region index unavailable: ${error.message}`));
const osrm = new OsrmService({ ...config, port: config.osrmPort, catalog, log });
const queue = new MapQueue({ ...config, catalog, osrm, log });
const requests = new MapRequests({ dataDir: config.dataDir, log: (line) => log(`[maps] ${line}`) });
await requests.init();
const updates = new UpdateChecker({
  catalog,
  dataDir: config.dataDir,
  queue,
  log: (line) => queue.log(line),
  checkDays: config.updateCheckDays,
  autoDays: config.autoUpdateDays,
});
const control = await startControlServer({ ...config, catalog, osrm, queue, geofabrik, updates, requests, log });
log(`[supervisor] control socket ${config.socketPath}`);

let web = null;
let shuttingDown = false;
let webRestarts = 0;

function startWeb() {
  web = spawn(process.execPath, [config.webEntry], {
    stdio: "inherit",
    env: {
      ...env,
      // Next standalone otherwise binds to the container hostname only.
      HOSTNAME: "0.0.0.0",
      PORT: String(config.webPort),
      OSRM_URL: `http://127.0.0.1:${config.osrmPort}`,
      ROGUEROUTE_CONTROL_SOCKET: config.socketPath,
    },
  });
  const started = Date.now();
  web.once("exit", (code, signal) => {
    web = null;
    if (shuttingDown) return;
    if (Date.now() - started > 60_000) webRestarts = 0;
    const delay = Math.min(30_000, 1_000 * 2 ** webRestarts++);
    log(`[web] exited (code ${code}, signal ${signal}); restarting in ${delay / 1000}s`);
    setTimeout(startWeb, delay).unref();
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`[supervisor] ${signal}: stopping`);
  setTimeout(() => process.exit(0), 25_000).unref();
  const webExited = web ? new Promise((resolve) => web.once("exit", resolve)) : Promise.resolve();
  web?.kill("SIGTERM");
  await Promise.all([webExited, osrm.stop(), queue.stop()]);
  control.close();
  process.exit(0);
}
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => void shutdown(signal));

startWeb();
// The website comes up immediately; OSRM loads in the background and reports its state.
osrm
  .boot(config.initialRegion)
  .catch((error) => log(`[osrm] boot failed: ${error.message}`))
  // Map work starts after the first graph is chosen, so it never competes with the boot load.
  .then(() => queue.init())
  .then(() => updates.init())
  .catch((error) => log(`[maps] queue failed to start: ${error.message}`));
