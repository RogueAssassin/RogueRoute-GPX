import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ControlError } from "./osrm.mjs";
import { fileState, missingGraphFiles } from "./catalog.mjs";

const PROFILE_FILES = { foot: "foot.lua", bike: "bicycle.lua", bicycle: "bicycle.lua", car: "car.lua" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

/**
 * Runs one map job at a time (download or prepare, over one or more regions) and keeps a
 * bounded log that the CLI and admin UI follow by sequence number.
 */
export class JobRunner {
  constructor({ catalog, dataDir, binDir, profilesDir, profile, osrm, log }) {
    this.catalog = catalog;
    this.dataDir = dataDir;
    this.binDir = binDir;
    this.profilesDir = profilesDir;
    this.profile = profile;
    this.osrm = osrm;
    this.baseLog = log;
    this.current = null;
    this.last = null;
    this.seq = 0;
  }

  status() {
    const job = this.current ?? this.last;
    return job && { ...job, log: job.log.slice(-200) };
  }

  log(job, line) {
    job.log.push({ seq: ++this.seq, line });
    if (job.log.length > 500) job.log.splice(0, job.log.length - 500);
    this.baseLog(`[job ${job.type}] ${line}`);
  }

  start({ type, regions }) {
    if (this.current) throw new ControlError(`A ${this.current.type} job is already running.`, 409, "busy");
    if (type !== "download" && type !== "prepare") throw new ControlError(`Unknown job type: ${type}`, 400);
    if (!Array.isArray(regions) || regions.length === 0) throw new ControlError("No regions given.", 400);
    const targets = regions.map((key) => {
      const region = this.catalog.find((item) => item.key === key);
      if (!region) throw new ControlError(`Unknown region: ${key}`, 400, "unknown-region");
      return region;
    });
    const job = {
      id: `${Date.now().toString(36)}`,
      type,
      regions: targets.map((region) => region.key),
      status: "running",
      currentRegion: null,
      progress: null,
      completed: [],
      failed: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
      log: [],
    };
    this.current = job;
    this.run(job, targets).finally(() => {
      job.finishedAt = new Date().toISOString();
      job.currentRegion = null;
      job.progress = null;
      this.last = job;
      this.current = null;
    });
    return { ...job };
  }

  async run(job, targets) {
    for (const region of targets) {
      job.currentRegion = region.key;
      try {
        if (job.type === "download") await this.download(job, region);
        else await this.prepare(job, region);
        job.completed.push(region.key);
      } catch (error) {
        job.failed.push(region.key);
        this.log(job, `[ERROR] ${region.key}: ${error.message}`);
      }
    }
    job.status = job.failed.length ? "failed" : "succeeded";
    this.log(job, `Finished. Completed: ${job.completed.length}. Failed: ${job.failed.length}.`);
  }

  async download(job, region) {
    const target = join(this.dataDir, region.pbf);
    const part = `${target}.part`;
    if ((await sizeOf(target)) > 0) {
      this.log(job, `[SKIP] ${region.label} is already downloaded.`);
      return;
    }
    this.log(job, `Downloading ${region.label} from ${region.url}`);
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await this.fetchToPart(job, region.url, part);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        this.log(job, `Attempt ${attempt} failed: ${error.message}. Partial file kept for resume.`);
        if (attempt < 5) await sleep(3_000 * attempt);
      }
    }
    if (lastError) throw lastError;

    const size = await sizeOf(part);
    if (size < 1_048_576) throw new Error(`Download is unexpectedly small (${size} bytes).`);
    const checksum = await fetch(`${region.url}.md5`, { signal: AbortSignal.timeout(30_000) })
      .then((response) => (response.ok ? response.text() : ""))
      .catch(() => "");
    const expected = checksum.trim().split(/\s+/)[0];
    if (expected) {
      this.log(job, "Verifying MD5 checksum.");
      const actual = await md5File(part);
      if (actual !== expected) {
        const invalid = `${part}.invalid-${new Date().toISOString().replace(/[:.]/g, "-")}`;
        await rename(part, invalid);
        throw new Error(`Checksum mismatch; kept ${invalid} and the next attempt starts cleanly.`);
      }
    } else {
      this.log(job, "[WARN] Geofabrik checksum unavailable; accepting the size-checked download.");
    }
    await rename(part, target);
    this.log(job, `[OK] ${region.pbf}`);
  }

  async fetchToPart(job, url, part) {
    let offset = await sizeOf(part);
    const response = await fetch(url, { headers: offset ? { range: `bytes=${offset}-` } : {}, redirect: "follow" });
    if (response.status === 416) return; // the partial file is already complete
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (offset && response.status !== 206) offset = 0; // server ignored the range: restart
    const length = Number(response.headers.get("content-length") || 0);
    const total = length ? offset + length : null;
    let received = offset;
    let lastReport = 0;
    job.progress = { bytes: received, total };
    const counter = new Transform({
      transform: (chunk, _encoding, callback) => {
        received += chunk.length;
        job.progress = { bytes: received, total };
        if (received - lastReport >= 256 * 1024 * 1024) {
          lastReport = received;
          this.log(job, `${(received / 1e9).toFixed(2)} GB${total ? ` of ${(total / 1e9).toFixed(2)} GB` : ""}`);
        }
        callback(null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(response.body), counter, createWriteStream(part, { flags: offset ? "a" : "w" }));
  }

  async prepare(job, region) {
    if (this.osrm.region?.key === region.key && this.osrm.child) {
      throw new Error(`${region.label} is the active graph. Switch to another region before rebuilding it.`);
    }
    const state = await fileState(this.dataDir, region);
    if (state === "prepared") {
      this.log(job, `[SKIP] ${region.label} is already prepared.`);
      return;
    }
    if (state !== "downloaded") throw new Error(`${region.label} is not downloaded. Run: rogueroute-gpx osm download ${region.key}`);
    const profile = join(this.profilesDir, PROFILE_FILES[this.profile] ?? "foot.lua");
    const osrm = join(this.dataDir, region.osrm);
    this.log(job, `Preparing ${region.label} with ${profile}`);
    await this.tool(job, "osrm-extract", ["-p", profile, join(this.dataDir, region.pbf)]);
    await this.tool(job, "osrm-partition", [osrm]);
    await this.tool(job, "osrm-customize", [osrm]);
    const missing = await missingGraphFiles(this.dataDir, region);
    if (missing.length) throw new Error(`Preparation produced no ${missing.join(", ")}`);
    this.log(job, `[OK] Prepared ${region.key}`);
    if (!this.osrm.child && (this.osrm.state === "no-graph" || this.osrm.state === "failed")) {
      this.log(job, `No graph was active; loading ${region.key}.`);
      await this.osrm.switchTo(region.key, { force: true }).catch((error) => this.log(job, `[WARN] ${error.message}`));
    }
  }

  tool(job, name, args) {
    return new Promise((resolve, reject) => {
      this.log(job, `$ ${name} ${args.join(" ")}`);
      const child = spawn(join(this.binDir, name), args, { cwd: this.dataDir, stdio: ["ignore", "pipe", "pipe"] });
      const forward = (chunk) => {
        for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) this.log(job, line);
      };
      child.stdout.on("data", forward);
      child.stderr.on("data", forward);
      child.once("error", reject);
      child.once("exit", (code, signal) =>
        code === 0 ? resolve() : reject(new Error(`${name} failed (code ${code}${signal ? `, signal ${signal}` : ""})`)),
      );
    });
  }
}
