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
  osm search TEXT                  Find any Geofabrik region (country, state, province) by name
  osm add REGION...                Queue regions: download if needed, then prepare
                                   REGION can also be a Geofabrik id from osm search (us/california)
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
  osm updates [--check]            Which regions have newer data on Geofabrik (--check asks now)
  osm update REGION...|--all       Download and prepare the latest data, then swap it in
                                   (the region keeps routing on the old data until the swap)
  osm delete REGION... --yes       Delete a region's map files (not the region being served)
                                   --remove also takes the region off the list
  osm requests                     Map requests from website visitors (approve them at /admin)
  osm switch REGION                Serve another prepared region now (ignores the cooldown)
  osm verify REGION                Check that a region is downloaded and prepared
  osm path                         Show the map data directory inside the container

Add --wait to add, prepare or download to wait for those regions and exit non-zero if one fails.

Regions estimated to need more memory than map work may use (85% of the container's memory
cap) are refused or skipped. Add --force to add, prepare, retry or prepare-all to try anyway;
the memory cap and watchdog still stop the tool before the host runs out of memory.
The website shows the same information at /maps, and /admin manages it.`);
}

async function status() {
  return call("GET", "/status");
}

/** Not prepared and estimated to need more memory than map work may use. */
const tooLarge = (region, limits) => Boolean(limits) && region.state !== "prepared" && region.memoryNeeded > limits.budget;

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

const queueAction = (action, regions, goal, force = false) => call("POST", "/queue", { action, regions, goal, force });

async function enqueue(regions, goal, args) {
  const force = args.includes("--force");
  const verb = goal === "downloaded" ? "download" : "download (if needed) and prepare";
  // Catalog keys are queued directly; anything else is looked up in the Geofabrik index
  // (for example us/california), added to the region list and queued.
  const known = new Set((await status()).regions.map((region) => region.key));
  const keys = regions.filter((name) => known.has(name));
  const queued = [...keys];
  let note = "";
  if (keys.length) {
    const result = await queueAction("add", keys, goal, force);
    if (result.added.length < keys.length) note = " (some were already queued)";
  }
  for (const id of regions.filter((name) => !known.has(name))) {
    const result = await call("POST", "/geofabrik", { action: "add", id, goal, force }, 150_000).catch((error) =>
      fail(`${error.message}${/Unknown/.test(error.message) ? ` Find the id with: ./rogueroute-gpx osm search ${id.split("/").pop()}` : ""}`),
    );
    if (result.isNew) console.log(`[OK] Added ${id} from the Geofabrik index as ${result.key}.`);
    queued.push(result.key);
  }
  console.log(`[OK] Queued to ${verb}: ${queued.join(" ")}${note}`);
  if (args.includes("--wait")) return follow(queued);
  console.log("[INFO] This runs in the background. Watch it with ./rogueroute-gpx osm follow, or open /maps.");
}

/** Search the Geofabrik index by name or id. */
async function search(text) {
  const index = await call("GET", "/geofabrik");
  if (!index.regions.length) fail(index.error ?? "The Geofabrik region index is not available yet.");
  const byId = new Map(index.regions.map((region) => [region.id, region]));
  const needle = text.toLowerCase();
  const found = index.regions.filter((region) => region.name.toLowerCase().includes(needle) || region.id.includes(needle));
  if (!found.length) return console.log(`No Geofabrik region matches "${text}".`);
  console.log(`${pad("ID", 34)}${pad("NAME", 30)}${pad("STATE", 12)}IN`);
  for (const region of found.slice(0, 50)) {
    const path = [];
    for (let parent = byId.get(region.parent); parent; parent = byId.get(parent.parent)) path.unshift(parent.name);
    console.log(`${pad(region.id, 34)}${pad(region.name, 30)}${pad(region.state ?? "", 12)}${path.join(" > ")}`);
  }
  if (found.length > 50) console.log(`... and ${found.length - 50} more. Narrow the search.`);
  console.log("Add one with: ./rogueroute-gpx osm add ID   (sizes and a map: /maps/download)");
}

function printQueue(queue) {
  const waiting = queue.pending.map((item) => (item.goal === "downloaded" ? `${item.region} (download)` : item.goal === "updated" ? `${item.region} (update)` : item.region));
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
      const { osrm, queue, disk, limits } = data;
      console.log(`Active region: ${data.activeRegion ?? "none"}`);
      console.log(`OSRM: ${osrm.state}${osrm.switchTarget ? ` -> ${osrm.switchTarget}` : ""}${osrm.error ? ` (${osrm.error})` : ""}`);
      printQueue(queue);
      if (disk) console.log(`Disk: ${gb(disk.free)} free of ${gb(disk.total)}`);
      if (limits) {
        console.log(
          `Memory: ${limits.capped ? `capped at ${gb(limits.cap)}` : `no cap (${gb(limits.cap)} host RAM)`}, map work up to ${gb(limits.budget)}, ` +
            `keeps ${gb(limits.floor)} of host memory free; disk priority ${limits.ioIdle ? "idle" : "normal"}`,
        );
      }
      console.log("");
      console.log(`${pad("REGION", 28)}STATE`);
      for (const region of data.regions) {
        const extra = [
          region.key === data.activeRegion && "active",
          region.queue,
          region.failure && "failed",
          tooLarge(region, limits) && `too large, needs ~${gb(region.memoryNeeded)}`,
        ].filter(Boolean);
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
      const { regions, limits } = await status();
      const wanted = {
        "download-missing": (region) => region.state === "missing" || region.state === "partial",
        "prepare-downloaded": (region) => region.state === "downloaded",
        "prepare-all": (region) => region.state !== "prepared",
      }[command];
      const goal = command === "download-missing" ? "downloaded" : "prepared";
      const candidates = regions.filter(wanted);
      const skipped = goal === "prepared" && !args.includes("--force") ? candidates.filter((region) => tooLarge(region, limits)) : [];
      for (const region of skipped) {
        console.log(`[SKIP] ${region.key}: needs ~${gb(region.memoryNeeded)}, map work may use ${gb(limits.budget)} (--force to include)`);
      }
      const keys = candidates.filter((region) => !skipped.includes(region)).map((region) => region.key);
      if (!keys.length) return console.log("[OK] Nothing to queue.");
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
      const result = await queueAction("retry", regionArgs.length ? regionArgs : undefined, undefined, args.includes("--force"));
      if (!result.added.length && !regionArgs.length) return console.log("[OK] No failed regions.");
      return console.log(`[OK] Queued again: ${regionArgs.length ? regionArgs.join(" ") : result.added.join(" ")}`);
    }
    case "updates": {
      const result = args.includes("--check") ? await call("POST", "/updates", { action: "check" }, 600_000) : await call("GET", "/updates");
      console.log(`Last checked: ${result.checkedAt ?? "never"}${result.checkDays ? ` (every ${result.checkDays} days)` : " (automatic checks are off)"}`);
      console.log(result.autoDays ? `Regions older than ${result.autoDays} days are updated automatically.` : "Updates are not applied automatically.");
      const entries = Object.entries(result.regions);
      if (!entries.length) return console.log("No downloaded regions have been checked yet. Run: ./rogueroute-gpx osm updates --check");
      console.log(`${pad("REGION", 28)}${pad("LOCAL DATA", 14)}${pad("GEOFABRIK", 14)}STATE`);
      const day = (iso) => (iso ? iso.slice(0, 10) : "?");
      for (const [key, entry] of entries) {
        console.log(`${pad(key, 28)}${pad(day(entry.localDate), 14)}${pad(day(entry.remoteDate), 14)}${entry.error ? `check failed: ${entry.error}` : entry.available ? "update available" : "up to date"}`);
      }
      return;
    }
    case "update": {
      let keys = regionArgs;
      if (args.includes("--all")) {
        const result = await call("GET", "/updates");
        keys = Object.entries(result.regions).filter(([, entry]) => entry.available).map(([key]) => key);
        if (!keys.length) return console.log("[OK] Every checked region is up to date. Check again with: ./rogueroute-gpx osm updates --check");
      }
      if (!keys.length) fail("Usage: rogueroute-gpx osm update REGION... | --all [--wait]");
      await queueAction("update", keys, undefined, args.includes("--force"));
      console.log(`[OK] Queued updates: ${keys.join(" ")}`);
      if (args.includes("--wait")) return follow(keys);
      return console.log("[INFO] Each region keeps routing on its current data until the new data is ready.");
    }
    case "delete": {
      if (!regionArgs.length) fail("Usage: rogueroute-gpx osm delete REGION... --yes [--remove]");
      await confirm("Delete the map files of", regionArgs, args);
      for (const key of regionArgs) {
        const result = await call("POST", "/files", { action: "delete", key, removeFromList: args.includes("--remove") });
        console.log(`[OK] ${key}: deleted ${result.deleted.length} file(s), ${gb(result.freed)} freed${result.removed ? ", removed from the list" : ""}.`);
      }
      return;
    }
    case "requests": {
      const { requests } = await call("GET", "/requests");
      if (!requests.length) return console.log("No map requests.");
      console.log(`${pad("GEOFABRIK ID", 34)}${pad("NAME", 28)}${pad("ASKED", 7)}${pad("LAST", 12)}STATUS`);
      for (const request of requests) {
        console.log(`${pad(request.id, 34)}${pad(request.name, 28)}${pad(request.count, 7)}${pad(request.lastAt.slice(0, 10), 12)}${request.status}`);
      }
      return console.log("Approve one with: ./rogueroute-gpx osm add ID   (or at /admin)");
    }
    case "search":
      if (!regionArgs.length) fail("Usage: rogueroute-gpx osm search TEXT");
      return search(regionArgs.join(" "));
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
