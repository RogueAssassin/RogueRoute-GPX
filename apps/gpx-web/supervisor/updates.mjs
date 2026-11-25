import { stat } from "node:fs/promises";
import { join } from "node:path";
import { fileState, readStateFile, writeStateFile } from "./catalog.mjs";

const UPDATES_FILE = "updates.json";
const DAY_MS = 86_400_000;
/** Newer server data within this margin of the local copy is the same extract. */
const SAME_DATA_MS = 6 * 3_600_000;

async function mtime(path) {
  try {
    return (await stat(path)).mtime.toISOString();
  } catch {
    return null;
  }
}

/**
 * Checks whether Geofabrik has newer data for regions that are downloaded or prepared here.
 * Each region's server date (Last-Modified of its .osm.pbf) is compared with the date of the
 * local copy: the server date recorded when it was downloaded, else the file date. Results are
 * saved in /data/.rogueroute-gpx/updates.json. Regions whose data is older than autoDays are
 * queued for an update automatically (0 = only report them).
 */
export class UpdateChecker {
  constructor({ catalog, dataDir, queue, log, checkDays = 7, autoDays = 30, fetchImpl = (...args) => fetch(...args) }) {
    this.catalog = catalog;
    this.dataDir = dataDir;
    this.queue = queue;
    this.log = log;
    this.checkDays = checkDays;
    this.autoDays = autoDays;
    this.fetch = fetchImpl;
    this.checkedAt = null;
    this.regions = {}; // key -> { remoteDate, remoteSize, localDate, available, error? }
    this.checking = null;
    this.timer = null;
  }

  async init() {
    const saved = await readStateFile(this.dataDir, UPDATES_FILE);
    this.checkedAt = typeof saved.checkedAt === "string" ? saved.checkedAt : null;
    this.regions = saved.regions && typeof saved.regions === "object" ? saved.regions : {};
    if (this.checkDays > 0) {
      // Check hourly whether a check is due, so a long uptime or a restart both keep the schedule.
      const due = () => {
        if (!this.checkedAt || Date.now() - Date.parse(this.checkedAt) >= this.checkDays * DAY_MS) {
          this.check().catch((error) => this.log(`[maps] update check failed: ${error.message}`));
        }
      };
      setTimeout(due, 5 * 60_000).unref();
      this.timer = setInterval(due, 3_600_000);
      this.timer.unref();
    }
  }

  stop() {
    clearInterval(this.timer);
  }

  /** Date of the local copy of a region's data, or null when there is none. */
  async localDate(region) {
    const history = this.queue.history[region.key] ?? {};
    return history.dataDate ?? history.downloadedAt ?? (await mtime(join(this.dataDir, region.pbf))) ?? (await mtime(join(this.dataDir, `${region.osrm}.mldgr`)));
  }

  /** Ask Geofabrik for the date of every downloaded or prepared region. */
  check() {
    this.checking ??= (async () => {
      const checked = {};
      let count = 0;
      for (const region of this.catalog) {
        if (!region.url) continue;
        const state = await fileState(this.dataDir, region);
        if (state !== "prepared" && state !== "downloaded") continue;
        const localDate = await this.localDate(region);
        try {
          const response = await this.fetch(region.url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(20_000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const modified = response.headers.get("last-modified");
          const remoteDate = modified ? new Date(modified).toISOString() : null;
          checked[region.key] = {
            remoteDate,
            remoteSize: Number(response.headers.get("content-length")) || null,
            localDate,
            available: Boolean(remoteDate && localDate && Date.parse(remoteDate) - Date.parse(localDate) > SAME_DATA_MS),
          };
        } catch (error) {
          checked[region.key] = { ...this.regions[region.key], localDate, error: error.message };
        }
        count++;
      }
      this.regions = checked;
      this.checkedAt = new Date().toISOString();
      await writeStateFile(this.dataDir, UPDATES_FILE, { checkedAt: this.checkedAt, regions: this.regions });
      const available = Object.entries(this.regions).filter(([, entry]) => entry.available).map(([key]) => key);
      this.log(`Checked ${count} region(s) for newer map data: ${available.length ? `updates for ${available.join(", ")}` : "all up to date"}.`);
      await this.autoUpdate(available);
      return this.status();
    })().finally(() => {
      this.checking = null;
    });
    return this.checking;
  }

  /** Queue updates of regions whose local data is older than autoDays. */
  async autoUpdate(available) {
    if (!(this.autoDays > 0)) return;
    const busy = new Set(this.queue.items.map((item) => item.region));
    const due = available.filter((key) => {
      const local = Date.parse(this.regions[key]?.localDate ?? "");
      return !busy.has(key) && !this.queue.failures[key] && Number.isFinite(local) && Date.now() - local >= this.autoDays * DAY_MS;
    });
    if (!due.length) return;
    try {
      await this.queue.act({ action: "update", regions: due });
    } catch (error) {
      this.log(`[WARN] Automatic update of ${due.join(", ")} not queued: ${error.message}`);
    }
  }

  /** A region's last check result, re-evaluated against its current download date (after an update). */
  entry(key) {
    const saved = this.regions[key];
    if (!saved) return null;
    const localDate = this.queue.history[key]?.dataDate ?? saved.localDate ?? null;
    const available = Boolean(saved.remoteDate && localDate && Date.parse(saved.remoteDate) - Date.parse(localDate) > SAME_DATA_MS);
    return { ...saved, localDate, available };
  }

  status() {
    return {
      checkedAt: this.checkedAt,
      checking: Boolean(this.checking),
      checkDays: this.checkDays,
      autoDays: this.autoDays,
      regions: this.regions,
    };
  }
}
