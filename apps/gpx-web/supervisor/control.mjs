import { createServer, request } from "node:http";
import { unlink } from "node:fs/promises";
import { fileState } from "./catalog.mjs";
import { diskSpace } from "./queue.mjs";
import { ControlError } from "./osrm.mjs";

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new ControlError("Request body is too large", 413);
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new ControlError("Request body is not valid JSON", 400);
  }
}

export async function statusPayload({ catalog, dataDir, osrm, queue }) {
  const maps = queue.status({ log: false });
  const queued = new Set(maps.pending.map((item) => item.region));
  const limits = await queue.limits();
  const regions = await Promise.all(
    catalog.map(async (region) => ({
      key: region.key,
      label: region.label,
      group: region.group,
      download: region.download,
      expanded: region.expanded,
      bounds: region.bounds,
      areas: region.areas ?? null,
      state: await fileState(dataDir, region),
      queue: maps.current?.region === region.key ? "working" : queued.has(region.key) ? "queued" : null,
      failure: maps.failures[region.key] ?? null,
      preparedAt: maps.history[region.key]?.preparedAt ?? null,
      memoryNeeded: await queue.estimate(region),
      peakMemory: maps.history[region.key]?.peakMemory ?? null,
    })),
  );
  return {
    ok: true,
    activeRegion: osrm.region?.key ?? null,
    osrm: osrm.status(),
    queue: maps,
    disk: await diskSpace(dataDir),
    memory: limits.cap,
    limits,
    regions,
  };
}

/** State of a catalog region for the downloader: files on disk and place in the queue. */
async function catalogState({ dataDir, queue }, region) {
  if (!region) return null;
  const maps = queue.status({ log: false });
  return {
    key: region.key,
    label: region.label,
    added: region.group === "added",
    state: await fileState(dataDir, region),
    queue: maps.current?.region === region.key ? "working" : maps.pending.some((item) => item.region === region.key) ? "queued" : null,
    failure: maps.failures[region.key]?.message ?? null,
  };
}

/** Prepared catalog regions with their outlines (or boxes), for coverage and the map. */
async function preparedRegions({ catalog, dataDir }) {
  const prepared = [];
  for (const region of catalog) if ((await fileState(dataDir, region)) === "prepared") prepared.push(region);
  return prepared;
}

/** Every Geofabrik region (no outlines) and how each relates to the catalog. */
async function indexPayload({ catalog, dataDir, geofabrik }) {
  const states = new Map();
  for (const region of catalog) if (region.geofabrik) states.set(region.geofabrik, { key: region.key, state: await fileState(dataDir, region) });
  const prepared = await preparedRegions({ catalog, dataDir });
  return {
    ok: true,
    fetchedAt: geofabrik.fetchedAt,
    error: geofabrik.regions.length ? null : geofabrik.error ?? (geofabrik.refreshing ? "The region index is loading." : "The region index is not available yet."),
    regions: geofabrik.regions.map(({ id, name, parent, bbox }) => ({ id, name, parent, bbox, ...(states.get(id) ?? { key: null, state: null }) })),
    prepared: prepared.map(({ key, label, geofabrik: id, areas, bounds }) => ({ key, label, id: id ?? null, areas: areas ?? null, bounds })),
  };
}

/** One Geofabrik region in detail: outline, sub-regions, size, memory estimate and coverage. */
async function regionPayload({ catalog, dataDir, geofabrik, queue, id }) {
  const region = geofabrik.get(id);
  if (!region) throw new ControlError(`Unknown Geofabrik region: ${id}`, 404, "unknown-region");
  const entry = geofabrik.catalogEntry(id);
  const size = await geofabrik.size(id);
  const limits = await queue.limits();
  const memoryNeeded = entry ? await queue.estimate(entry) : size ? queue.estimateBytes(size) : null;
  const prepared = await preparedRegions({ catalog, dataDir });
  return {
    ok: true,
    region: { id: region.id, name: region.name, parent: region.parent, url: region.url, bbox: region.bbox, areas: region.areas },
    parents: (() => {
      const chain = [];
      for (let parent = geofabrik.get(region.parent); parent; parent = geofabrik.get(parent.parent)) chain.unshift({ id: parent.id, name: parent.name });
      return chain;
    })(),
    children: geofabrik.children(id).map((child) => ({ id: child.id, name: child.name, areas: child.areas, key: geofabrik.catalogEntry(child.id)?.key ?? null })),
    size,
    memoryNeeded,
    limits: { cap: limits.cap, capped: limits.capped, budget: limits.budget },
    tooLarge: memoryNeeded !== null && memoryNeeded > limits.budget,
    catalog: await catalogState({ dataDir, queue }, entry),
    coveredBy: geofabrik.coveredBy(region.bbox, prepared, entry?.key).map(({ key, label }) => ({ key, label })),
  };
}

/** add (to the catalog and the queue), remove (an added region without files), refresh (the index). */
async function indexAction({ dataDir, geofabrik, queue, body }) {
  const action = String(body.action ?? "");
  if (action === "refresh") {
    await geofabrik.refresh();
    return { ok: true, regions: geofabrik.regions.length };
  }
  if (action === "add") {
    const id = String(body.id ?? "");
    if (!geofabrik.get(id)) throw new ControlError(`Unknown Geofabrik region: ${id}`, 404, "unknown-region");
    const goal = body.goal === "downloaded" ? "downloaded" : "prepared";
    const isNew = !geofabrik.catalogEntry(id);
    const entry = await geofabrik.addToCatalog(id, isNew ? await geofabrik.size(id) : null);
    try {
      const result = await queue.act({ action: "add", regions: [entry.key], goal, force: body.force === true });
      return { ok: true, key: entry.key, isNew, ...result };
    } catch (error) {
      // Refused (for example too large): keep the list as it was before this request.
      if (isNew) await geofabrik.removeFromCatalog(entry.key).catch(() => {});
      throw error;
    }
  }
  if (action === "remove") {
    const key = String(body.key ?? "");
    const entry = geofabrik.catalog.find((region) => region.key === key);
    if (!entry || entry.group !== "added") throw new ControlError(`${key} is not a region added from the downloader.`, 400);
    if (queue.items.some((item) => item.region === key)) throw new ControlError(`${entry.label} is in the map queue. Remove it from the queue first.`, 409);
    if ((await fileState(dataDir, entry)) !== "missing") {
      throw new ControlError(`${entry.label} has map files on disk. Delete them first, then remove it from the list.`, 409);
    }
    await geofabrik.removeFromCatalog(key);
    return { ok: true, removed: key };
  }
  throw new ControlError(`Unknown action: ${action}`, 400);
}

/**
 * Control API over a unix socket inside the container. Only processes in the container (the
 * web server and the rogueroute-gpx CLI) can reach it; nothing is published on the network.
 */
export async function startControlServer({ socketPath, catalog, dataDir, osrm, queue, geofabrik, log }) {
  const server = createServer(async (req, res) => {
    const send = (status, payload) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    };
    try {
      if (req.method === "GET" && req.url === "/status") {
        return send(200, await statusPayload({ catalog, dataDir, osrm, queue }));
      }
      if (req.method === "POST" && req.url === "/switch") {
        const body = await readJson(req);
        return send(200, { ok: true, ...(await osrm.switchTo(String(body.region || ""), { force: body.force === true })) });
      }
      const url = new URL(req.url, "http://supervisor");
      if (req.method === "GET" && url.pathname === "/queue") {
        return send(200, { ok: true, queue: queue.status({ since: Number(url.searchParams.get("since")) || 0 }) });
      }
      if (req.method === "POST" && url.pathname === "/queue") {
        const body = await readJson(req);
        const result = await queue.act({ action: String(body.action || ""), regions: body.regions, goal: body.goal, force: body.force === true });
        return send(200, { ok: true, ...result, queue: queue.status({ log: false }) });
      }
      if (geofabrik && req.method === "GET" && url.pathname === "/geofabrik") {
        return send(200, await indexPayload({ catalog, dataDir, geofabrik }));
      }
      if (geofabrik && req.method === "GET" && url.pathname === "/geofabrik/region") {
        return send(200, await regionPayload({ catalog, dataDir, geofabrik, queue, id: url.searchParams.get("id") ?? "" }));
      }
      if (geofabrik && req.method === "POST" && url.pathname === "/geofabrik") {
        return send(200, await indexAction({ catalog, dataDir, geofabrik, queue, body: await readJson(req) }));
      }
      send(404, { error: "Not found" });
    } catch (error) {
      const status = error instanceof ControlError ? error.status : 500;
      if (status >= 500) log(`[control] ${req.method} ${req.url}: ${error.message}`);
      send(status, { error: error.message, code: error.code ?? "error" });
    }
  });
  server.requestTimeout = 0; // a region switch waits for the graph to load
  await unlink(socketPath).catch(() => {});
  await new Promise((resolve, reject) => server.listen(socketPath, resolve).once("error", reject));
  return server;
}

/** Minimal client used by the CLI; the web app has its own typed copy in src/lib/control.ts. */
export function controlRequest(socketPath, method, path, body, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = request(
      { socketPath, method, path, headers: payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {} },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          let data = {};
          try {
            data = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          } catch {
            /* keep empty */
          }
          if ((res.statusCode ?? 500) >= 400) {
            const error = new Error(data.error || `HTTP ${res.statusCode}`);
            error.status = res.statusCode;
            error.code = data.code;
            reject(error);
          } else resolve(data);
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error("Control request timed out")));
    req.once("error", reject);
    req.end(payload);
  });
}
