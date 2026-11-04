import { spawn } from "node:child_process";
import { join } from "node:path";
import { isPrepared, missingGraphFiles, readState, writeState } from "./catalog.mjs";

export class ControlError extends Error {
  constructor(message, status = 400, code = "bad-request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs osrm-routed as a child process and swaps it to another graph on request. Only one
 * switch runs at a time, switches are rate limited, and a failed switch falls back to the
 * previous graph.
 */
export class OsrmService {
  constructor({ catalog, dataDir, binDir, port, profile, startupTimeoutMs, cooldownMs, log }) {
    this.catalog = catalog;
    this.dataDir = dataDir;
    this.binDir = binDir;
    this.port = port;
    this.profile = profile;
    this.startupTimeoutMs = startupTimeoutMs;
    this.cooldownMs = cooldownMs;
    this.log = log;
    this.child = null;
    this.region = null;
    this.state = "stopped"; // stopped | no-graph | loading | ready | switching | failed
    this.error = null;
    this.since = new Date().toISOString();
    this.switchTarget = null;
    this.lastSwitchAt = 0;
    this.restarts = 0;
    this.stopping = false;
  }

  find(key) {
    return this.catalog.find((region) => region.key === key);
  }

  setState(state, error = null) {
    this.state = state;
    this.error = error;
    this.since = new Date().toISOString();
  }

  status() {
    const cooldownRemainingMs = Math.max(0, this.cooldownMs - (Date.now() - this.lastSwitchAt));
    return {
      state: this.state,
      region: this.region?.key ?? null,
      graph: this.region?.osrm ?? null,
      error: this.error,
      since: this.since,
      switchTarget: this.switchTarget,
      cooldownRemainingSeconds: this.lastSwitchAt ? Math.ceil(cooldownRemainingMs / 1000) : 0,
      pid: this.child?.pid ?? null,
    };
  }

  /** Choose and load the initial graph: saved state, then OSRM_REGION, then the first prepared region. */
  async boot(preferredKey) {
    const saved = await readState(this.dataDir);
    const candidates = [saved.activeRegion, preferredKey, ...this.catalog.map((region) => region.key)].filter(Boolean);
    for (const key of candidates) {
      const region = this.find(key);
      if (region && (await isPrepared(this.dataDir, region))) {
        try {
          await this.start(region);
          await writeState(this.dataDir, { ...saved, activeRegion: region.key }).catch(() => {});
        } catch (error) {
          this.log(`[osrm] ${region.key} failed to start: ${error.message}`);
        }
        return;
      }
    }
    this.setState("no-graph", "No prepared region found. Run: rogueroute-gpx osm download REGION && rogueroute-gpx osm prepare REGION");
    this.log(`[osrm] ${this.error}`);
  }

  async start(region) {
    const missing = await missingGraphFiles(this.dataDir, region);
    if (missing.length) throw new ControlError(`Region ${region.key} is not prepared. Missing: ${missing.join(", ")}`, 409, "not-prepared");
    this.region = region;
    this.setState("loading");
    this.log(`[osrm] loading ${region.key} (${region.osrm})`);
    const child = spawn(
      join(this.binDir, "osrm-routed"),
      ["--algorithm", "mld", "--ip", "127.0.0.1", "--port", String(this.port), join(this.dataDir, region.osrm)],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    this.child = child;
    const forward = (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) this.log(`[osrm] ${line}`);
    };
    child.stdout.on("data", forward);
    child.stderr.on("data", forward);
    const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
    child.once("error", (error) => this.log(`[osrm] spawn failed: ${error.message}`));
    exited.then(({ code, signal }) => this.onExit(child, code, signal));

    const deadline = Date.now() + this.startupTimeoutMs;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) {
        this.setState("failed", `osrm-routed exited while loading ${region.key}`);
        throw new ControlError(this.error, 500, "osrm-exited");
      }
      if (await this.ping()) {
        this.setState("ready");
        this.restarts = 0;
        this.log(`[osrm] ready on ${region.key}`);
        return;
      }
      await sleep(1_000);
    }
    await this.stop();
    this.setState("failed", `osrm-routed did not become ready within ${this.startupTimeoutMs / 1000}s`);
    throw new ControlError(this.error, 500, "osrm-timeout");
  }

  async ping() {
    try {
      // NoSegment at 0,0 is fine: any non-5xx answer proves the graph is loaded and serving.
      const response = await fetch(`http://127.0.0.1:${this.port}/nearest/v1/${this.profile}/0,0?number=1`, {
        signal: AbortSignal.timeout(2_000),
      });
      return response.status < 500;
    } catch {
      return false;
    }
  }

  onExit(child, code, signal) {
    if (this.child !== child) return;
    this.child = null;
    if (this.stopping || this.state === "switching") return;
    this.log(`[osrm] osrm-routed exited unexpectedly (code ${code}, signal ${signal})`);
    if (this.state === "loading") return; // start() reports the failure
    this.setState("failed", `osrm-routed exited (code ${code}, signal ${signal})`);
    if (this.region && this.restarts < 5) {
      const delay = Math.min(30_000, 2_000 * 2 ** this.restarts++);
      this.log(`[osrm] restarting in ${delay / 1000}s`);
      setTimeout(() => {
        if (this.state === "failed" && !this.child) this.start(this.region).catch((error) => this.setState("failed", error.message));
      }, delay).unref();
    }
  }

  async stop() {
    const child = this.child;
    if (!child) return;
    this.stopping = true;
    try {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      const killed = await Promise.race([exited.then(() => true), sleep(15_000).then(() => false)]);
      if (!killed) {
        child.kill("SIGKILL");
        await exited;
      }
    } finally {
      if (this.child === child) this.child = null;
      this.stopping = false;
    }
  }

  async switchTo(key, { force = false } = {}) {
    const target = this.find(key);
    if (!target) throw new ControlError(`Unknown region: ${key}`, 400, "unknown-region");
    if (this.state === "switching" || this.state === "loading") {
      throw new ControlError(`OSRM is busy loading ${this.switchTarget ?? this.region?.key}. Try again shortly.`, 409, "busy");
    }
    if (this.region?.key === key && this.state === "ready") return { region: key, switched: false };
    const remaining = this.cooldownMs - (Date.now() - this.lastSwitchAt);
    if (!force && this.lastSwitchAt && remaining > 0) {
      throw new ControlError(`Region switching is cooling down. Try again in ${Math.ceil(remaining / 1000)} seconds.`, 409, "cooldown");
    }
    if (!(await isPrepared(this.dataDir, target))) {
      throw new ControlError(`Region ${target.label} is not prepared on this server.`, 409, "not-prepared");
    }

    const previous = this.region;
    this.switchTarget = key;
    this.lastSwitchAt = Date.now();
    this.setState("switching");
    this.log(`[osrm] switching ${previous?.key ?? "none"} -> ${key}`);
    try {
      await this.stop();
      await this.start(target);
      const saved = await readState(this.dataDir);
      await writeState(this.dataDir, { ...saved, activeRegion: key });
      return { region: key, switched: true };
    } catch (error) {
      await this.stop();
      if (previous && previous.key !== key) {
        this.log(`[osrm] switch to ${key} failed (${error.message}); restoring ${previous.key}`);
        try {
          await this.start(previous);
        } catch (rollbackError) {
          this.setState("failed", `Switch to ${key} failed and ${previous.key} could not be restored: ${rollbackError.message}`);
          throw new ControlError(this.error, 500, "rollback-failed");
        }
      } else {
        this.setState("failed", error.message);
      }
      throw new ControlError(`Switch to ${target.label} failed: ${error.message}. ${previous ? `Still serving ${previous.label}.` : ""}`.trim(), 500, "switch-failed");
    } finally {
      this.switchTarget = null;
    }
  }
}
