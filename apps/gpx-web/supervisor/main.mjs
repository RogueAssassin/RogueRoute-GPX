#!/usr/bin/env node
// rogueroute-gpx supervisor: PID 1 of the single container. Runs the web server and
// osrm-routed as child processes, switches regions by restarting osrm-routed on another
// graph, and runs download/prepare jobs. No container engine access is needed.
import { spawn } from "node:child_process";
import { loadCatalog } from "./catalog.mjs";
import { startControlServer } from "./control.mjs";
import { JobRunner } from "./jobs.mjs";
import { OsrmService } from "./osrm.mjs";

const env = process.env;
const number = (value, fallback, min = 0) => {
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
};

const log = (line) => console.log(`${new Date().toISOString()} ${line}`);

const catalog = await loadCatalog(config.catalogFile);
const osrm = new OsrmService({ ...config, port: config.osrmPort, catalog, log });
const jobs = new JobRunner({ ...config, catalog, osrm, log });
const control = await startControlServer({ ...config, catalog, osrm, jobs, log });
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
  await Promise.all([webExited, osrm.stop()]);
  control.close();
  process.exit(0);
}
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => void shutdown(signal));

startWeb();
// The website comes up immediately; OSRM loads in the background and reports its state.
osrm.boot(config.initialRegion).catch((error) => log(`[osrm] boot failed: ${error.message}`));
