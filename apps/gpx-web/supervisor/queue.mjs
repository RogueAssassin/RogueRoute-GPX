import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { readFile, readdir, rename, stat, statfs, unlink, writeFile } from "node:fs/promises";
import { setPriority, totalmem } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ControlError } from "./osrm.mjs";
import { catalogBytes, fileState, missingGraphFiles, readStateFile, writeStateFile } from "./catalog.mjs";

const PROFILE_FILES = { foot: "foot.lua", bike: "bicycle.lua", bicycle: "bicycle.lua", car: "car.lua" };
const QUEUE_FILE = "queue.json";
const GOALS = new Set(["downloaded", "prepared"]);
/** Rough multiplier of the .osm.pbf size for the disk check. */
const PREPARED_DISK_FACTOR = 3;
/**
 * Estimated peak memory of osrm-extract as a multiple of the .osm.pbf size. The foot profile
 * keeps footways and tracks, so it needs the most. Once a region has been prepared, its
 * measured peak is used instead.
 */
const EXTRACT_MEMORY_FACTORS = { foot: 5, bike: 4, bicycle: 4, car: 3 };
/** Share of the memory cap that map work may plan to use; the rest is for the website and osrm-routed. */
const BUDGET_SHARE = 0.85;
/** The watchdog stops a tool when the container reaches this share of its cap. */
const CGROUP_STOP_SHARE = 0.95;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const gb = (bytes) => `${(bytes / 1e9).toFixed(1)} GB`;
/** Node reports network errors as "fetch failed"; the cause holds the useful part. */
const describe = (error) => {
  const cause = error?.cause;
  const detail = cause ? [cause.code, cause.message].filter(Boolean).join(" ") : "";
  return detail && !error.message.includes(detail) ? `${error.message} (${detail})` : error.message;
};

async function sizeOf(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function md5File(path) {
  const hash = createHash("md5");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

export async function diskSpace(dir) {
  try {
    const info = await statfs(dir);
    return { free: info.bavail * info.bsize, total: info.blocks * info.bsize };
  } catch {
    return null;
  }
}

/** Memory available to the container: the cgroup v2 limit when one is set, else host RAM. */
export async function memoryLimit() {
  const host = totalmem();
  try {
    const raw = (await readFile("/sys/fs/cgroup/memory.max", "utf8")).trim();
    const limit = Number(raw);
    return raw !== "max" && Number.isFinite(limit) && limit > 0 ? Math.min(limit, host) : host;
  } catch {
    return host;
  }
}

/** "64g", "65536m", "8G", "1.5GB" or plain bytes, in binary units like Docker; 0 when unset or invalid. */
export function parseSize(text) {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([kmgt]?)i?b?\s*$/i.exec(String(text ?? ""));
  if (!match) return 0;
  const power = { "": 0, k: 1, m: 2, g: 3, t: 4 }[match[2].toLowerCase()];
  return Math.round(Number(match[1]) * 1024 ** power);
}

/** Free host memory (MemAvailable) and the container's cgroup usage and limit, in bytes. */
export async function memoryProbe() {
  const result = { hostAvailable: null, hostTotal: totalmem(), cgroupCurrent: null, cgroupMax: null };
  try {
    const meminfo = await readFile("/proc/meminfo", "utf8");
    const available = /^MemAvailable:\s+(\d+) kB/m.exec(meminfo);
    if (available) result.hostAvailable = Number(available[1]) * 1024;
  } catch {
    /* not Linux */
  }
  try {
    result.cgroupCurrent = Number((await readFile("/sys/fs/cgroup/memory.current", "utf8")).trim()) || null;
    const max = (await readFile("/sys/fs/cgroup/memory.max", "utf8")).trim();
    result.cgroupMax = max === "max" ? null : Number(max) || null;
  } catch {
    /* no cgroup v2 limit visible */
  }
  return result;
}

/** Peak resident memory (VmHWM) of a process, in bytes, or 0. */
async function peakOf(pid) {
  try {
    const match = /^VmHWM:\s+(\d+) kB/m.exec(await readFile(`/proc/${pid}/status`, "utf8"));
    return match ? Number(match[1]) * 1024 : 0;
  } catch {
    return 0;
  }
}

class Cancelled extends Error {}

/** A region that is estimated to need more memory than map work may use. */
export class TooLarge extends Error {
  constructor(region, needed, budget) {
    super(
      `${region.label} needs about ${gb(needed)} of memory to prepare; map work may use ${gb(budget)} on this server. ` +
        "Pick a smaller region, raise ROGUEROUTE_MEMORY_LIMIT, or add it with --force to try anyway.",
    );
    this.code = "too-large";
    this.step = "check";
  }
}

/**
 * Background map queue. Each item asks for a region to reach a goal ("downloaded" or
 * "prepared"); the worker downloads and/or prepares one region at a time, smallest first, at
 * low CPU priority. The queue is saved in /data/.rogueroute-gpx/queue.json, so a restart
 * resumes where it stopped (downloads continue from their .part file).
 */
export class MapQueue {
  constructor({
    catalog,
    dataDir,
    binDir,
    profilesDir,
    profile,
    osrm,
    log,
    threads = 0,
    niceness = 10,
    autoPrepare = true,
    memoryCap = 0, // bytes; the cap ./rogueroute-gpx applied (also enforced by the cgroup when supported)
    memoryFloor = 0, // bytes of free host memory to keep; 0 = max(2 GB, 5% of host RAM)
    ioIdle = true, // run the OSRM tools at idle disk priority (ionice -c 3)
    watchdogMs = 2000,
    probe = memoryProbe,
  }) {
    this.catalog = catalog;
    this.dataDir = dataDir;
    this.binDir = binDir;
    this.profilesDir = profilesDir;
    this.profile = profile;
    this.osrm = osrm;
    this.baseLog = log;
    this.threads = threads;
    this.niceness = niceness;
    this.autoPrepare = autoPrepare;
    this.memoryCap = memoryCap;
    this.memoryFloor = memoryFloor || Math.max(2 * 1024 ** 3, Math.round(totalmem() * 0.05));
    this.ionice = ioIdle && existsSync("/usr/bin/ionice") ? "/usr/bin/ionice" : null;
    this.watchdogMs = watchdogMs;
    this.probe = probe;
    this.items = []; // [{ region, goal, addedAt }]; items[0] is the one being worked on
    this.paused = false;
    this.failures = {}; // region -> { message, step, at }
    this.history = {}; // region -> { downloadedAt, preparedAt, prepareSeconds }
    this.current = null; // { region, goal, step, steps, stepIndex, startedAt, stepStartedAt, progress }
    this.lines = [];
    this.seq = 0;
    this.child = null;
    this.abort = null;
    this.cancelling = false;
    this.stopping = false;
    this.ready = false; // set by init(); tasks added earlier wait for it
    this.saving = Promise.resolve();
  }

  find(key) {
    return this.catalog.find((region) => region.key === key);
  }

  /** The memory cap that applies (cgroup, configured cap, host RAM) and what map work may use of it. */
  async limits() {
    const container = await memoryLimit();
    const cap = this.memoryCap > 0 ? Math.min(container, this.memoryCap) : container;
    return {
      cap,
      capped: cap < totalmem(),
      budget: Math.round(cap * BUDGET_SHARE),
      floor: this.memoryFloor,
      ioIdle: Boolean(this.ionice),
    };
  }

  /** Estimated peak memory to prepare a region: its measured peak if known, else from the extract size. */
  async estimate(region) {
    const measured = this.history[region.key]?.peakMemory;
    if (measured) return Math.round(measured * 1.1);
    const pbf = (await sizeOf(join(this.dataDir, region.pbf))) || catalogBytes(region.download);
    return Math.round(pbf * (EXTRACT_MEMORY_FACTORS[this.profile] ?? EXTRACT_MEMORY_FACTORS.foot));
  }

  /** Throw TooLarge when a region probably cannot be prepared within the memory budget. */
  async checkSize(region) {
    const [needed, { budget }] = await Promise.all([this.estimate(region), this.limits()]);
    if (needed > budget) throw new TooLarge(region, needed, budget);
  }

  log(line) {
    this.lines.push({ seq: ++this.seq, line });
    if (this.lines.length > 1000) this.lines.splice(0, this.lines.length - 1000);
    this.baseLog(`[maps] ${line}`);
  }

  save() {
    const snapshot = {
      paused: this.paused,
      items: this.items,
      failures: this.failures,
      history: this.history,
    };
    this.saving = this.saving
      .then(() => writeStateFile(this.dataDir, QUEUE_FILE, snapshot))
      .catch((error) => this.baseLog(`[maps] could not save the queue: ${error.message}`));
    return this.saving;
  }

  /** Load the saved queue, optionally queue downloaded-but-unprepared regions, and start. */
  async init() {
    const saved = await readStateFile(this.dataDir, QUEUE_FILE);
    this.paused = saved.paused === true;
    this.failures = saved.failures && typeof saved.failures === "object" ? saved.failures : {};
    this.history = saved.history && typeof saved.history === "object" ? saved.history : {};
    const loaded = (Array.isArray(saved.items) ? saved.items : []).filter(
      (item) => this.find(item?.region) && GOALS.has(item.goal),
    );
    // Keep anything queued through the API while OSRM was still loading.
    this.items = [...loaded, ...this.items.filter((item) => !loaded.some((entry) => entry.region === item.region))];
    if (this.items.length) this.log(`Resuming ${this.items.length} queued map task(s).`);
    if (this.autoPrepare) {
      const waiting = [];
      for (const region of this.catalog) {
        if (this.failures[region.key] || this.items.some((item) => item.region === region.key)) continue;
        if ((await fileState(this.dataDir, region)) !== "downloaded") continue;
        try {
          await this.checkSize(region);
          waiting.push(region.key);
        } catch (error) {
          this.log(`Auto-prepare skipped ${region.key}: ${error.message}`);
        }
      }
      if (waiting.length) {
        this.log(`Auto-prepare: queued ${waiting.join(", ")} (downloaded but not prepared).`);
        await this.enqueue(waiting, "prepared");
      }
    }
    await this.sortPending();
    await this.save();
    this.ready = true;
    this.kick();
  }

  /** Smallest first, so more regions become usable sooner; the item in progress stays first. */
  async sortPending() {
    const weight = async (key) => {
      const region = this.find(key);
      return (await sizeOf(join(this.dataDir, region.pbf))) || catalogBytes(region.download) || Number.MAX_SAFE_INTEGER;
    };
    const head = this.current ? this.items.slice(0, 1) : [];
    const rest = this.current ? this.items.slice(1) : this.items.slice();
    const weights = new Map(await Promise.all(rest.map(async (item) => [item.region, await weight(item.region)])));
    rest.sort((a, b) => weights.get(a.region) - weights.get(b.region));
    this.items = [...head, ...rest];
  }

  async enqueue(keys, goal, force = false) {
    const added = [];
    for (const key of keys) {
      delete this.failures[key];
      const existing = this.items.find((item) => item.region === key);
      if (existing) {
        if (goal === "prepared") existing.goal = "prepared";
        if (force) existing.force = true;
        continue;
      }
      this.items.push({ region: key, goal, addedAt: new Date().toISOString(), ...(force ? { force: true } : {}) });
      added.push(key);
    }
    await this.sortPending();
    return added;
  }

  validate(regions) {
    if (!Array.isArray(regions) || regions.length === 0) throw new ControlError("No regions given.", 400);
    for (const key of regions) {
      if (!this.find(String(key))) throw new ControlError(`Unknown region: ${key}`, 400, "unknown-region");
    }
    return [...new Set(regions.map(String))];
  }

  /** Refuse regions that are too large to prepare, unless forced. Returns the keys that fit. */
  async sizeGate(keys, { force, skip = false }) {
    if (force) return keys;
    const fits = [];
    const refused = [];
    for (const key of keys) {
      try {
        await this.checkSize(this.find(key));
        fits.push(key);
      } catch (error) {
        refused.push(error.message);
      }
    }
    if (refused.length && !skip) throw new ControlError(refused.join("\n"), 400, "too-large");
    for (const message of refused) this.log(`[SKIP] ${message}`);
    return fits;
  }

  /** Apply a queue action from the control API. */
  async act({ action, regions, goal, force = false }) {
    force = force === true;
    switch (action) {
      case "add": {
        const keys = this.validate(regions);
        const target = goal === "downloaded" ? "downloaded" : "prepared";
        if (target === "prepared") await this.sizeGate(keys, { force });
        const added = await this.enqueue(keys, target, force);
        this.log(
          `Queued ${keys.join(", ")} (${target === "prepared" ? "download if needed, then prepare" : "download only"}${force ? ", size check skipped" : ""}).`,
        );
        await this.save();
        this.kick();
        return { added };
      }
      case "remove": {
        const keys = this.validate(regions);
        const removed = [];
        for (const key of keys) {
          if (this.current?.region === key) continue;
          const before = this.items.length;
          this.items = this.items.filter((item) => item.region !== key);
          if (this.items.length < before) removed.push(key);
        }
        if (keys.includes(this.current?.region)) await this.cancel();
        if (removed.length) this.log(`Removed ${removed.join(", ")} from the queue.`);
        await this.save();
        return { removed };
      }
      case "retry": {
        const named = Boolean(regions?.length);
        // Retrying everything skips regions that are too large; naming one reports why.
        const keys = await this.sizeGate(named ? this.validate(regions) : Object.keys(this.failures).filter((key) => this.find(key)), { force, skip: !named });
        if (!keys.length) return { added: [] };
        const added = await this.enqueue(keys, "prepared", force);
        this.log(`Retrying ${keys.join(", ")}.`);
        await this.save();
        this.kick();
        return { added };
      }
      case "pause":
        this.paused = true;
        this.log("Queue paused; the current task finishes first. Use cancel to stop it now.");
        await this.save();
        return {};
      case "resume":
        this.paused = false;
        this.log("Queue resumed.");
        await this.save();
        this.kick();
        return {};
      case "cancel":
        return { cancelled: await this.cancel() };
      case "clear": {
        const removed = this.items.filter((item) => item.region !== this.current?.region).map((item) => item.region);
        this.items = this.items.filter((item) => item.region === this.current?.region);
        if (removed.length) this.log(`Cleared ${removed.length} waiting task(s).`);
        await this.save();
        return { removed };
      }
      default:
        throw new ControlError(`Unknown queue action: ${action}`, 400);
    }
  }

  /** Stop the task in progress; it is removed from the queue, not recorded as a failure. */
  async cancel() {
    if (!this.current) return null;
    const key = this.current.region;
    this.cancelling = true;
    this.abort?.abort();
    this.child?.kill("SIGTERM");
    this.log(`Cancelling ${key}.`);
    return key;
  }

  /** Stop work for a container shutdown; the queue is kept and resumes on the next start. */
  async stop() {
    this.stopping = true;
    this.abort?.abort();
    this.child?.kill("SIGTERM");
    await this.saving;
  }

  kick() {
    if (!this.ready || this.current || this.paused || this.stopping || !this.items.length) return;
    const item = this.items[0];
    this.current = {
      region: item.region,
      goal: item.goal,
      step: "starting",
      steps: [],
      stepIndex: 0,
      startedAt: new Date().toISOString(),
      stepStartedAt: new Date().toISOString(),
      progress: null,
    };
    void this.work(item).finally(() => {
      const interrupted = this.stopping;
      this.current = null;
      this.child = null;
      this.abort = null;
      this.cancelling = false;
      if (interrupted) return;
      this.items = this.items.filter((entry) => entry !== item);
      void this.save().then(() => this.kick());
    });
  }

  setStep(step) {
    const steps = this.current.steps;
    this.current.step = step;
    this.current.stepIndex = Math.max(0, steps.indexOf(step));
    this.current.stepStartedAt = new Date().toISOString();
    this.current.progress = null;
  }

  async work(item) {
    const region = this.find(item.region);
    const started = Date.now();
    try {
      const state = await fileState(this.dataDir, region);
      if (state === "prepared" || (item.goal === "downloaded" && state === "downloaded")) {
        this.log(`[SKIP] ${region.label} is already ${state}.`);
        return;
      }
      const steps = [];
      if (state !== "downloaded") steps.push("download");
      if (item.goal === "prepared") steps.push("extract", "partition", "customize");
      this.current.steps = steps;
      if (steps[0] === "download") {
        this.setStep("download");
        await this.download(region);
        this.history[region.key] = { ...this.history[region.key], downloadedAt: new Date().toISOString() };
      }
      if (item.goal === "prepared") {
        const prepareStarted = Date.now();
        this.peak = 0;
        await this.prepare(region, item);
        this.history[region.key] = {
          ...this.history[region.key],
          preparedAt: new Date().toISOString(),
          prepareSeconds: Math.round((Date.now() - prepareStarted) / 1000),
          ...(this.peak ? { peakMemory: this.peak } : {}),
        };
        if (this.peak) this.log(`Peak memory while preparing ${region.label}: ${gb(this.peak)}.`);
      }
      delete this.failures[region.key];
      this.log(`[OK] ${region.label} is ${item.goal} (${Math.round((Date.now() - started) / 60_000)} min).`);
      if (item.goal === "prepared" && !this.osrm.child && (this.osrm.state === "no-graph" || this.osrm.state === "failed")) {
        this.log(`No graph was being served; loading ${region.key}.`);
        await this.osrm.switchTo(region.key, { force: true }).catch((error) => this.log(`[WARN] ${error.message}`));
      }
    } catch (error) {
      if (this.stopping) {
        this.log(`Stopped ${region.key} for shutdown; it resumes on the next start.`);
      } else if (this.cancelling || error instanceof Cancelled) {
        this.log(`Cancelled ${region.key}.`);
      } else {
        this.failures[region.key] = {
          message: error.message,
          step: error.step ?? this.current?.step ?? null,
          ...(error.code ? { code: error.code } : {}),
          at: new Date().toISOString(),
        };
        this.log(`[ERROR] ${region.key}: ${error.message}`);
      }
    }
  }

  async download(region) {
    const target = join(this.dataDir, region.pbf);
    const part = `${target}.part`;
    this.log(`Downloading ${region.label} from ${region.url}`);
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await this.fetchToPart(region.url, part);
        lastError = undefined;
        break;
      } catch (error) {
        if (this.cancelling || this.stopping) throw new Cancelled();
        if (error.code === "disk-full") throw error;
        lastError = error;
        this.log(`Attempt ${attempt} failed: ${describe(error)}. Partial file kept for resume.`);
        if (attempt < 5) await sleep(3_000 * attempt);
      }
    }
    if (lastError) throw new Error(`Download failed: ${describe(lastError)}`);

    const size = await sizeOf(part);
    if (size < 1_048_576) throw new Error(`Download is unexpectedly small (${size} bytes).`);
    const checksum = await fetch(`${region.url}.md5`, { signal: AbortSignal.timeout(30_000) })
      .then((response) => (response.ok ? response.text() : ""))
      .catch(() => "");
    const expected = checksum.trim().split(/\s+/)[0];
    if (expected) {
      this.current.progress = { verifying: true };
      this.log("Verifying MD5 checksum.");
      const actual = await md5File(part);
      if (actual !== expected) {
        const invalid = `${part}.invalid-${new Date().toISOString().replace(/[:.]/g, "-")}`;
        await rename(part, invalid);
        throw new Error(`Checksum mismatch; kept ${invalid} and the next attempt starts cleanly.`);
      }
    } else {
      this.log("[WARN] Geofabrik checksum unavailable; accepting the size-checked download.");
    }
    await rename(part, target);
    this.log(`[OK] Downloaded ${region.pbf} (${gb(size)}).`);
  }

  async fetchToPart(url, part) {
    let offset = await sizeOf(part);
    this.abort = new AbortController();
    const response = await fetch(url, {
      headers: offset ? { range: `bytes=${offset}-` } : {},
      redirect: "follow",
      signal: this.abort.signal,
    });
    if (response.status === 416) return; // the partial file is already complete
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (offset && response.status !== 206) offset = 0; // server ignored the range: restart
    const length = Number(response.headers.get("content-length") || 0);
    const total = length ? offset + length : null;
    const disk = await diskSpace(this.dataDir);
    if (disk && length && disk.free < length * 1.05) {
      await response.body?.cancel();
      const error = new Error(`Not enough disk space: the download needs ${gb(length)} more, ${gb(disk.free)} is free.`);
      error.code = "disk-full";
      throw error;
    }
    let received = offset;
    let lastLog = offset;
    let windowStart = Date.now();
    let windowBytes = 0;
    let rate = 0;
    this.current.progress = { bytes: received, total, rate };
    const counter = new Transform({
      transform: (chunk, _encoding, callback) => {
        received += chunk.length;
        windowBytes += chunk.length;
        const elapsed = Date.now() - windowStart;
        if (elapsed >= 2_000) {
          rate = Math.round((windowBytes * 1000) / elapsed);
          windowStart = Date.now();
          windowBytes = 0;
        }
        this.current.progress = { bytes: received, total, rate };
        if (received - lastLog >= 512 * 1024 * 1024) {
          lastLog = received;
          this.log(`${gb(received)}${total ? ` of ${gb(total)}` : ""}`);
        }
        callback(null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(response.body), counter, createWriteStream(part, { flags: offset ? "a" : "w" }), {
      signal: this.abort.signal,
    });
  }

  async prepare(region, item = {}) {
    if (this.osrm.region?.key === region.key && this.osrm.child) {
      throw new Error(`${region.label} is the active graph. Switch to another region before rebuilding it.`);
    }
    const pbfSize = await sizeOf(join(this.dataDir, region.pbf));
    if (!pbfSize) throw new Error(`${region.label} is not downloaded.`);

    // Leftovers from an interrupted build take disk space and could mix with the new graph.
    const stale = (await readdir(this.dataDir)).filter((name) => name.startsWith(`${region.osrm}.`));
    await Promise.all(stale.map((name) => unlink(join(this.dataDir, name)).catch(() => {})));

    const disk = await diskSpace(this.dataDir);
    const diskNeeded = pbfSize * PREPARED_DISK_FACTOR;
    if (disk && disk.free < diskNeeded) {
      throw new Error(`Not enough disk space: preparing ${region.label} needs about ${gb(diskNeeded)}, ${gb(disk.free)} is free.`);
    }
    const memoryNeeded = await this.estimate(region);
    const limits = await this.limits();
    if (memoryNeeded > limits.budget) {
      // Checked again here: the downloaded file can be larger than the catalog estimate.
      if (!item.force) throw new TooLarge(region, memoryNeeded, limits.budget);
      this.log(`[WARN] ${region.label} probably needs about ${gb(memoryNeeded)}; trying anyway within the ${gb(limits.cap)} cap (--force).`);
    }

    const profile = join(this.profilesDir, PROFILE_FILES[this.profile] ?? "foot.lua");
    const osrm = join(this.dataDir, region.osrm);
    const threads = this.threads > 0 ? ["-t", String(this.threads)] : [];
    this.log(
      `Preparing ${region.label} (${gb(pbfSize)} extract, about ${gb(memoryNeeded)} of memory) with ${profile}. ` +
        `Memory cap ${limits.capped ? gb(limits.cap) : "none (host RAM)"}, keeping ${gb(limits.floor)} of host memory free.`,
    );
    this.setStep("extract");
    await this.tool("osrm-extract", ["-p", profile, ...threads, join(this.dataDir, region.pbf)], memoryNeeded);
    this.setStep("partition");
    await this.tool("osrm-partition", [...threads, osrm], memoryNeeded);
    this.setStep("customize");
    await this.tool("osrm-customize", [...threads, osrm], memoryNeeded);
    const missing = await missingGraphFiles(this.dataDir, region);
    if (missing.length) throw new Error(`Preparation produced no ${missing.join(", ")}`);
  }

  tool(name, args, memoryNeeded) {
    if (this.cancelling || this.stopping) return Promise.reject(new Cancelled());
    return new Promise((resolve, reject) => {
      this.log(`$ ${name} ${args.join(" ")}`);
      // ionice -c 3 (idle disk priority) execs the tool, so the pid stays the tool's.
      const [command, commandArgs] = this.ionice
        ? [this.ionice, ["-c", "3", join(this.binDir, name), ...args]]
        : [join(this.binDir, name), args];
      const child = spawn(command, commandArgs, { cwd: this.dataDir, stdio: ["ignore", "pipe", "pipe"] });
      this.child = child;
      if (child.pid) {
        try {
          if (this.niceness) setPriority(child.pid, this.niceness); // keep routing and the website responsive
        } catch {
          /* lowering priority is best effort */
        }
        // If memory runs out anyway, the kernel kills the tool rather than the website or osrm-routed.
        writeFile(`/proc/${child.pid}/oom_score_adj`, "1000").catch(() => {});
      }
      let stopReason = null;
      let checking = false;
      const watchdog = setInterval(async () => {
        if (checking || stopReason || child.exitCode !== null) return;
        checking = true;
        try {
          this.peak = Math.max(this.peak ?? 0, await peakOf(child.pid));
          const memory = await this.probe();
          if (memory.hostAvailable !== null && memory.hostAvailable < this.memoryFloor) {
            stopReason = `the host had only ${gb(memory.hostAvailable)} of memory free (the floor is ${gb(this.memoryFloor)})`;
          } else if (memory.cgroupMax && memory.cgroupCurrent > memory.cgroupMax * CGROUP_STOP_SHARE) {
            stopReason = `the container reached ${gb(memory.cgroupCurrent)} of its ${gb(memory.cgroupMax)} memory cap`;
          }
          if (stopReason) {
            this.log(`[WARN] Memory watchdog: stopping ${name} because ${stopReason}.`);
            child.kill("SIGKILL");
          }
        } finally {
          checking = false;
        }
      }, this.watchdogMs);
      child.once("exit", () => clearInterval(watchdog));
      const forward = (chunk) => {
        for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) this.log(line);
      };
      child.stdout.on("data", forward);
      child.stderr.on("data", forward);
      child.once("error", (error) => {
        clearInterval(watchdog);
        reject(error);
      });
      child.once("exit", (code, signal) => {
        this.child = null;
        if (code === 0) return resolve();
        if (this.cancelling || this.stopping) return reject(new Cancelled());
        if (stopReason) {
          const error = new Error(
            `${name} was stopped by the memory watchdog: ${stopReason}. It probably needs about ${gb(memoryNeeded)}. ` +
              "Pick a smaller region, or free memory on the host, then retry.",
          );
          error.code = "memory-watchdog";
          return reject(error);
        }
        if (signal === "SIGKILL" || code === 137) {
          return reject(
            new Error(`${name} was killed, most likely out of memory (this region needs roughly ${gb(memoryNeeded)} of RAM).`),
          );
        }
        reject(new Error(`${name} failed (code ${code}${signal ? `, signal ${signal}` : ""})`));
      });
    });
  }

  status({ since = 0, log = true } = {}) {
    return {
      paused: this.paused,
      current: this.current && { ...this.current },
      pending: this.items.filter((item) => item.region !== this.current?.region).map(({ region, goal }) => ({ region, goal })),
      failures: this.failures,
      history: this.history,
      ...(log ? { log: this.lines.filter((entry) => entry.seq > since).slice(-300) } : {}),
      lastSeq: this.seq,
    };
  }
}
