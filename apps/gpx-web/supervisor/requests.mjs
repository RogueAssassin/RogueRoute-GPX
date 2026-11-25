import { readStateFile, writeStateFile } from "./catalog.mjs";
import { ControlError } from "./osrm.mjs";

const REQUESTS_FILE = "requests.json";
/** Open requests kept at most; beyond this new regions are refused until an admin catches up. */
const MAX_OPEN = 200;
/** Requests kept in total (resolved ones are dropped oldest first). */
const MAX_KEPT = 500;
const MAX_NOTES = 5;
const NOTE_LENGTH = 200;

const clean = (text, length) =>
  String(text ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, length);

/**
 * Map requests from website visitors: one entry per Geofabrik region, counted when it is asked
 * for again. An admin approves (adds and queues it) or dismisses each one. Saved in
 * /data/.rogueroute-gpx/requests.json.
 */
export class MapRequests {
  constructor({ dataDir, log }) {
    this.dataDir = dataDir;
    this.log = log;
    this.requests = []; // [{ id, name, count, firstAt, lastAt, status, notes, resolvedAt?, key? }]
    this.saving = Promise.resolve();
  }

  async init() {
    const saved = await readStateFile(this.dataDir, REQUESTS_FILE);
    this.requests = (Array.isArray(saved.requests) ? saved.requests : []).filter(
      (request) => request && typeof request.id === "string" && typeof request.name === "string",
    );
  }

  save() {
    this.saving = this.saving
      .then(() => writeStateFile(this.dataDir, REQUESTS_FILE, { requests: this.requests }))
      .catch((error) => this.log(`[maps] could not save map requests: ${error.message}`));
    return this.saving;
  }

  get openCount() {
    return this.requests.filter((request) => request.status === "open").length;
  }

  list() {
    // Open first, most asked for first, then the newest.
    const rank = (request) => (request.status === "open" ? 0 : 1);
    return [...this.requests].sort((a, b) => rank(a) - rank(b) || b.count - a.count || b.lastAt.localeCompare(a.lastAt));
  }

  /** Record a request for a Geofabrik region; asking again for an open one counts it again. */
  async add({ id, name, note }) {
    const now = new Date().toISOString();
    const text = clean(note, NOTE_LENGTH);
    let request = this.requests.find((entry) => entry.id === id);
    if (!request) {
      if (this.openCount >= MAX_OPEN) throw new ControlError("Too many map requests are waiting. Try again later.", 429, "too-many-requests");
      request = { id, name: clean(name, 120) || id, count: 0, firstAt: now, lastAt: now, status: "open", notes: [] };
      this.requests.push(request);
      this.log(`Map requested: ${request.name} (${id}).`);
    }
    if (request.status !== "open") {
      // Asked for again after it was dismissed or approved (for example its files were deleted).
      request.status = "open";
      delete request.resolvedAt;
    }
    request.count += 1;
    request.lastAt = now;
    if (text) request.notes = [...request.notes, { text, at: now }].slice(-MAX_NOTES);
    this.trim();
    await this.save();
    return request;
  }

  /** Mark a request approved or dismissed. */
  async resolve(id, status, extra = {}) {
    const request = this.requests.find((entry) => entry.id === id);
    if (!request) throw new ControlError(`No request for ${id}.`, 404, "unknown-request");
    request.status = status;
    request.resolvedAt = new Date().toISOString();
    Object.assign(request, extra);
    await this.save();
    return request;
  }

  trim() {
    if (this.requests.length <= MAX_KEPT) return;
    const resolved = this.requests.filter((request) => request.status !== "open").sort((a, b) => a.lastAt.localeCompare(b.lastAt));
    const drop = new Set(resolved.slice(0, this.requests.length - MAX_KEPT));
    this.requests = this.requests.filter((request) => !drop.has(request));
  }
}
