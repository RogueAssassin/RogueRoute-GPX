import { createServer, request } from "node:http";
import { unlink } from "node:fs/promises";
import { fileState } from "./catalog.mjs";
import { diskSpace, memoryLimit } from "./queue.mjs";
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
  const regions = await Promise.all(
    catalog.map(async (region) => ({
      key: region.key,
      label: region.label,
      group: region.group,
      download: region.download,
      expanded: region.expanded,
      bounds: region.bounds,
      state: await fileState(dataDir, region),
      queue: maps.current?.region === region.key ? "working" : queued.has(region.key) ? "queued" : null,
      failure: maps.failures[region.key] ?? null,
      preparedAt: maps.history[region.key]?.preparedAt ?? null,
    })),
  );
  return {
    ok: true,
    activeRegion: osrm.region?.key ?? null,
    osrm: osrm.status(),
    queue: maps,
    disk: await diskSpace(dataDir),
    memory: await memoryLimit(),
    regions,
  };
}

/**
 * Control API over a unix socket inside the container. Only processes in the container (the
 * web server and the rogueroute-gpx CLI) can reach it; nothing is published on the network.
 */
export async function startControlServer({ socketPath, catalog, dataDir, osrm, queue, log }) {
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
        const result = await queue.act({ action: String(body.action || ""), regions: body.regions, goal: body.goal });
        return send(200, { ok: true, ...result, queue: queue.status({ log: false }) });
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
