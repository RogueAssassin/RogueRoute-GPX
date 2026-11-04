#!/usr/bin/env node
// rogueroute-gpx command inside the container. The host script runs it through
// `docker exec` / `podman exec`, so map management needs nothing installed on the host.
import { createInterface } from "node:readline/promises";
import { controlRequest } from "./control.mjs";

const socketPath = process.env.ROGUEROUTE_CONTROL_SOCKET || "/tmp/rogueroute-gpx.sock";
const call = (method, path, body, timeoutMs) => controlRequest(socketPath, method, path, body, timeoutMs);
const switchTimeoutMs = (Number(process.env.ROGUEROUTE_STARTUP_TIMEOUT_SECONDS) || 600) * 1000 + 120_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error(`[ERROR] ${message}`);
  process.exit(1);
}

const pad = (value, width) => String(value ?? "").padEnd(width);

function help() {
  console.log(`rogueroute-gpx map commands (run on the host as ./rogueroute-gpx osm ...)

  osm list                         Regions with rough download and prepared sizes
  osm status                       Active region, OSRM state, running job and every region's state
  osm download REGION...           Download Geofabrik extracts (resumes .part files, checks MD5)
  osm download-missing --yes       Download every region that is not downloaded yet
  osm prepare REGION...            Build OSRM MLD graphs from downloaded extracts
  osm prepare-downloaded --yes     Prepare every downloaded but unprepared region
  osm switch REGION                Serve another prepared region now (ignores the cooldown)
  osm verify REGION                Check that a region is downloaded and prepared
  osm job                          Follow the running download/prepare job
  osm path                         Show the map data directory inside the container`);
}

async function status() {
  return call("GET", "/status");
}

async function confirm(action, keys, args) {
  if (args.includes("--yes")) return;
  if (!process.stdin.isTTY) fail(`Confirmation required for ${action} of ${keys.length} region(s). Repeat with --yes.`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${action} ${keys.length} region(s): ${keys.join(" ")}. This may use substantial disk and time. Continue? [y/N] `);
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) fail("Cancelled.");
}

async function follow() {
  let lastSeq = 0;
  let job;
  for (;;) {
    ({ job } = await call("GET", "/jobs"));
    if (!job) return console.log("No job has run since the container started.");
    for (const entry of job.log) {
      if (entry.seq > lastSeq) {
        console.log(entry.line);
        lastSeq = entry.seq;
      }
    }
    if (job.status !== "running") break;
    await sleep(2_000);
  }
  if (job.status === "failed") process.exit(1);
}

async function startJob(type, regions) {
  const { job } = await call("POST", "/jobs", { type, regions });
  console.log(`[INFO] Started ${type} job for: ${job.regions.join(" ")} (Ctrl-C stops following; the job keeps running)`);
  await follow();
}

async function osm(command, args) {
  switch (command) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
      return help();
    case "path":
      return console.log(process.env.ROGUEROUTE_DATA_DIR || "/data");
    case "list": {
      const { regions } = await status();
      console.log(`${pad("REGION", 28)}${pad("NAME", 30)}${pad("DOWNLOAD", 13)}PREPARED`);
      for (const region of regions) console.log(`${pad(region.key, 28)}${pad(region.label, 30)}${pad(region.download, 13)}${region.expanded}`);
      return;
    }
    case "status": {
      const data = await status();
      const { osrm, job } = data;
      console.log(`Active region: ${data.activeRegion ?? "none"}`);
      console.log(`OSRM: ${osrm.state}${osrm.switchTarget ? ` -> ${osrm.switchTarget}` : ""}${osrm.error ? ` (${osrm.error})` : ""}`);
      if (job) console.log(`Job: ${job.type} ${job.status}${job.currentRegion ? ` (${job.currentRegion})` : ""}`);
      console.log("");
      console.log(`${pad("REGION", 28)}STATE`);
      for (const region of data.regions) console.log(`${pad(region.key, 28)}${region.state}${region.key === data.activeRegion ? " (active)" : ""}`);
      return;
    }
    case "download":
    case "prepare":
      if (!args.length) fail(`Usage: rogueroute-gpx osm ${command} REGION [REGION...]`);
      return startJob(command, args);
    case "download-missing": {
      const { regions } = await status();
      const keys = regions.filter((region) => region.state === "missing" || region.state === "partial").map((region) => region.key);
      if (!keys.length) return console.log("[OK] Every catalog region is already downloaded.");
      await confirm("Download", keys, args);
      return startJob("download", keys);
    }
    case "prepare-downloaded": {
      const { regions } = await status();
      const keys = regions.filter((region) => region.state === "downloaded").map((region) => region.key);
      if (!keys.length) return console.log("[OK] Every downloaded region is prepared.");
      await confirm("Prepare", keys, args);
      return startJob("prepare", keys);
    }
    case "switch": {
      if (!args[0]) fail("Usage: rogueroute-gpx osm switch REGION");
      console.log(`[INFO] Loading ${args[0]}...`);
      const result = await call("POST", "/switch", { region: args[0], force: true }, switchTimeoutMs);
      return console.log(result.switched ? `[OK] Serving ${result.region}` : `[OK] ${result.region} is already active`);
    }
    case "verify": {
      if (!args[0]) fail("Usage: rogueroute-gpx osm verify REGION");
      const { regions } = await status();
      const region = regions.find((item) => item.key === args[0]);
      if (!region) fail(`Unknown region '${args[0]}'. Run: rogueroute-gpx osm list`);
      if (region.state !== "prepared") fail(`${region.key} is ${region.state}, not prepared.`);
      return console.log(`[OK] ${region.key} is prepared.`);
    }
    case "job":
      return follow();
    default:
      fail(`Unknown osm command: ${command}. Run: rogueroute-gpx osm help`);
  }
}

const [command, sub, ...rest] = process.argv.slice(2);
try {
  if (command === "osm") await osm(sub, rest);
  else if (command === "status") console.log(JSON.stringify(await status(), (key, value) => (key === "bounds" ? undefined : value), 2));
  else help();
} catch (error) {
  if (error.code === "ENOENT" || error.code === "ECONNREFUSED") fail("The rogueroute-gpx supervisor is not running in this container.");
  fail(error.message);
}
