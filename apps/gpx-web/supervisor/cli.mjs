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

Map work runs in the background inside the container, one region at a time, smallest first.
It keeps going when you close the terminal and resumes after a restart.

  osm status                       Active region, OSRM state, the map queue and every region
  osm list                         Regions with rough download and prepared sizes
  osm add REGION...                Queue regions: download if needed, then prepare
  osm prepare REGION...            Same as add
  osm download REGION...           Queue downloads only (no preparation)
  osm prepare-downloaded [--yes]   Queue every downloaded but unprepared region
  osm prepare-all --yes            Queue every catalog region (downloads well over 100 GB)
  osm download-missing --yes       Queue downloads of every region that is not downloaded
  osm queue                        Show the queue, the task in progress and failures
  osm queue pause|resume           Stop or restart taking new tasks (the current one finishes)
  osm queue cancel                 Stop the task in progress now
  osm queue remove REGION...       Take regions out of the queue
  osm queue clear                  Remove every waiting task
  osm retry [REGION...]            Queue failed regions again (all failed ones by default)
  osm follow                       Follow the map log until the queue is empty (Ctrl-C to stop)
  osm switch REGION                Serve another prepared region now (ignores the cooldown)
  osm verify REGION                Check that a region is downloaded and prepared
  osm path                         Show the map data directory inside the container

Add --wait to add, prepare or download to wait for those regions and exit non-zero if one fails.
The website shows the same information at /maps.`);
}

async function status() {
  return call("GET", "/status");
}

const gb = (bytes) => `${(bytes / 1e9).toFixed(1)} GB`;
const minutes = (iso) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));

function describeCurrent(current) {
  if (!current) return "idle";
  const step = current.steps.length > 1 ? ` (step ${current.stepIndex + 1} of ${current.steps.length})` : "";
  let detail = "";
  const progress = current.progress;
  if (progress?.verifying) detail = ", verifying checksum";
  else if (progress?.total) {
    detail = `, ${Math.floor((progress.bytes / progress.total) * 100)}% of ${gb(progress.total)}`;
    if (progress.rate) detail += ` at ${(progress.rate / 1e6).toFixed(1)} MB/s`;
  }
  return `${current.region}: ${current.step}${step}${detail}, ${minutes(current.stepStartedAt)} min in this step`;
}

async function confirm(action, keys, args) {
  if (args.includes("--yes")) return;
  if (!process.stdin.isTTY) fail(`Confirmation required for ${action} of ${keys.length} region(s). Repeat with --yes.`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${action} ${keys.length} region(s): ${keys.join(" ")}. This may use substantial disk and time. Continue? [y/N] `);
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) fail("Cancelled.");
}

/** Print the map log until the given regions (or the whole queue) are done. */
async function follow(regions = null) {
  let since = 0;
  let queue;
  for (;;) {
    ({ queue } = await call("GET", `/queue?since=${since}`));
    for (const entry of queue.log) console.log(entry.line);
    since = queue.lastSeq;
    const busy = [queue.current?.region, ...queue.pending.map((item) => item.region)].filter(Boolean);
    const waiting = regions ? busy.filter((key) => regions.includes(key)) : busy;
    if (!waiting.length) break;
    if (queue.paused && !queue.current) {
      console.log("[WARN] The queue is paused. Run: rogueroute-gpx osm queue resume");
      break;
    }
    await sleep(2_000);
  }
  const failed = Object.keys(queue.failures).filter((key) => !regions || regions.includes(key));
  if (failed.length) {
    for (const key of failed) console.error(`[ERROR] ${key}: ${queue.failures[key].message}`);
    process.exit(1);
  }
}

const queueAction = (action, regions, goal) => call("POST", "/queue", { action, regions, goal });

async function enqueue(regions, goal, args) {
  const result = await queueAction("add", regions, goal);
  const verb = goal === "downloaded" ? "download" : "download (if needed) and prepare";
  const note = result.added.length < regions.length ? " (some were already queued)" : "";
  console.log(`[OK] Queued to ${verb}: ${regions.join(" ")}${note}`);
  if (args.includes("--wait")) return follow(regions);
  console.log("[INFO] This runs in the background. Watch it with ./rogueroute-gpx osm follow, or open /maps.");
}

function printQueue(queue) {
  const waiting = queue.pending.map((item) => (item.goal === "downloaded" ? `${item.region} (download)` : item.region));
  console.log(`Map queue: ${queue.paused ? "paused" : "running"}`);
  console.log(`Now: ${describeCurrent(queue.current)}`);
  console.log(`Waiting: ${waiting.length ? waiting.join(", ") : "none"}`);
  for (const [key, failure] of Object.entries(queue.failures)) {
    console.log(`Failed: ${key} during ${failure.step ?? "?"}: ${failure.message}`);
  }
}

async function osm(command, args) {
  const regionArgs = args.filter((arg) => !arg.startsWith("--"));
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
      const { osrm, queue, disk } = data;
      console.log(`Active region: ${data.activeRegion ?? "none"}`);
      console.log(`OSRM: ${osrm.state}${osrm.switchTarget ? ` -> ${osrm.switchTarget}` : ""}${osrm.error ? ` (${osrm.error})` : ""}`);
      printQueue(queue);
      if (disk) console.log(`Disk: ${gb(disk.free)} free of ${gb(disk.total)}`);
      console.log("");
      console.log(`${pad("REGION", 28)}STATE`);
      for (const region of data.regions) {
        const extra = [region.key === data.activeRegion && "active", region.queue, region.failure && "failed"].filter(Boolean);
        console.log(`${pad(region.key, 28)}${region.state}${extra.length ? ` (${extra.join(", ")})` : ""}`);
      }
      return;
    }
    case "add":
    case "prepare":
    case "download":
      if (!regionArgs.length) fail(`Usage: rogueroute-gpx osm ${command} REGION [REGION...] [--wait]`);
      return enqueue(regionArgs, command === "download" ? "downloaded" : "prepared", args);
    case "download-missing":
    case "prepare-downloaded":
    case "prepare-all": {
      const { regions } = await status();
      const wanted = {
        "download-missing": (region) => region.state === "missing" || region.state === "partial",
        "prepare-downloaded": (region) => region.state === "downloaded",
        "prepare-all": (region) => region.state !== "prepared",
      }[command];
      const keys = regions.filter(wanted).map((region) => region.key);
      if (!keys.length) return console.log("[OK] Nothing to queue.");
      const goal = command === "download-missing" ? "downloaded" : "prepared";
      await confirm(goal === "downloaded" ? "Download" : "Download (if needed) and prepare", keys, args);
      return enqueue(keys, goal, args);
    }
    case "queue": {
      const [action, ...rest] = regionArgs;
      if (!action) return printQueue((await call("GET", "/queue")).queue);
      if (!["pause", "resume", "cancel", "remove", "clear"].includes(action)) fail(`Unknown queue action: ${action}`);
      if (action === "remove" && !rest.length) fail("Usage: rogueroute-gpx osm queue remove REGION...");
      const result = await queueAction(action, rest.length ? rest : undefined);
      if (action === "cancel") return console.log(result.cancelled ? `[OK] Cancelled ${result.cancelled}` : "[OK] Nothing is running.");
      if (action === "remove" || action === "clear") return console.log(`[OK] Removed: ${result.removed.join(" ") || "nothing"}`);
      return console.log(`[OK] Queue ${action === "pause" ? "paused" : "resumed"}.`);
    }
    case "retry": {
      const result = await queueAction("retry", regionArgs.length ? regionArgs : undefined);
      if (!result.added.length && !regionArgs.length) return console.log("[OK] No failed regions.");
      return console.log(`[OK] Queued again: ${regionArgs.length ? regionArgs.join(" ") : result.added.join(" ")}`);
    }
    case "follow":
    case "job":
      return follow();
    case "switch": {
      if (!regionArgs[0]) fail("Usage: rogueroute-gpx osm switch REGION");
      console.log(`[INFO] Loading ${regionArgs[0]}...`);
      const result = await call("POST", "/switch", { region: regionArgs[0], force: true }, switchTimeoutMs);
      return console.log(result.switched ? `[OK] Serving ${result.region}` : `[OK] ${result.region} is already active`);
    }
    case "verify": {
      if (!regionArgs[0]) fail("Usage: rogueroute-gpx osm verify REGION");
      const { regions } = await status();
      const region = regions.find((item) => item.key === regionArgs[0]);
      if (!region) fail(`Unknown region '${regionArgs[0]}'. Run: rogueroute-gpx osm list`);
      if (region.state !== "prepared") fail(`${region.key} is ${region.state}, not prepared.`);
      return console.log(`[OK] ${region.key} is prepared.`);
    }
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
