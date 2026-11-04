import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readState } from "./catalog.mjs";
import { JobRunner } from "./jobs.mjs";
import { OsrmService } from "./osrm.mjs";

// A stand-in for osrm-routed: serves /nearest on --port, or exits when the graph is "broken".
const FAKE_ROUTED = `#!/usr/bin/env node
const http = require("node:http");
const args = process.argv.slice(2);
const port = Number(args[args.indexOf("--port") + 1]);
const graph = args.at(-1);
if (graph.includes("broken")) { console.error("cannot load " + graph); process.exit(3); }
const server = http.createServer((req, res) => { res.writeHead(400); res.end(JSON.stringify({ code: "NoSegment", graph })); });
server.listen(port, "127.0.0.1");
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`;

async function freePort() {
  const server = createServer().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const region = (key) => ({ key, label: key, graph: key, pbf: `${key}-latest.osm.pbf`, osrm: `${key}-latest.osrm`, bounds: [] });

async function fixture(t, { cooldownMs = 0 } = {}) {
  const root = await mkdtemp(join(tmpdir(), "rogueroute-gpx-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataDir = join(root, "data");
  const binDir = join(root, "bin");
  await Promise.all([mkdir(dataDir), mkdir(binDir)]);
  await writeFile(join(binDir, "osrm-routed"), FAKE_ROUTED);
  await chmod(join(binDir, "osrm-routed"), 0o755);
  const catalog = [region("alpha"), region("beta"), region("broken"), region("missing")];
  for (const key of ["alpha", "beta", "broken"]) {
    for (const suffix of ["mldgr", "partition", "cell_metrics"]) await writeFile(join(dataDir, `${key}-latest.osrm.${suffix}`), "x");
  }
  const logs = [];
  const osrm = new OsrmService({
    catalog,
    dataDir,
    binDir,
    port: await freePort(),
    profile: "foot",
    startupTimeoutMs: 15_000,
    cooldownMs,
    log: (line) => logs.push(line),
  });
  t.after(() => osrm.stop());
  return { osrm, dataDir, binDir, catalog, logs };
}

test("boots the saved or preferred region and switches between graphs", async (t) => {
  const { osrm, dataDir } = await fixture(t);
  await osrm.boot("beta");
  assert.equal(osrm.status().state, "ready");
  assert.equal(osrm.status().region, "beta");

  const result = await osrm.switchTo("alpha");
  assert.deepEqual(result, { region: "alpha", switched: true });
  assert.equal(osrm.status().region, "alpha");
  assert.equal((await readState(dataDir)).activeRegion, "alpha");
  assert.deepEqual(await osrm.switchTo("alpha"), { region: "alpha", switched: false });
});

test("a failed switch restores the previous graph", async (t) => {
  const { osrm } = await fixture(t);
  await osrm.boot("alpha");
  await assert.rejects(osrm.switchTo("broken"), /Still serving alpha/);
  assert.equal(osrm.status().state, "ready");
  assert.equal(osrm.status().region, "alpha");
});

test("rejects unprepared regions and enforces the cooldown", async (t) => {
  const { osrm } = await fixture(t, { cooldownMs: 60_000 });
  await osrm.boot("alpha");
  await assert.rejects(osrm.switchTo("missing"), (error) => error.code === "not-prepared");
  await assert.rejects(osrm.switchTo("nowhere"), (error) => error.code === "unknown-region");
  await osrm.switchTo("beta");
  await assert.rejects(osrm.switchTo("alpha"), (error) => error.code === "cooldown");
  await osrm.switchTo("alpha", { force: true });
  assert.equal(osrm.status().region, "alpha");
});

test("reports no-graph when nothing is prepared", async (t) => {
  const { osrm, catalog } = await fixture(t);
  osrm.catalog = [catalog[3]];
  await osrm.boot("missing");
  assert.equal(osrm.status().state, "no-graph");
});

test("jobs refuse to rebuild the active graph and run one at a time", async (t) => {
  const { osrm, dataDir, binDir, catalog } = await fixture(t);
  await osrm.boot("alpha");
  const jobs = new JobRunner({ catalog, dataDir, binDir, profilesDir: binDir, profile: "foot", osrm, log: () => {} });
  jobs.start({ type: "prepare", regions: ["alpha"] });
  assert.throws(() => jobs.start({ type: "prepare", regions: ["beta"] }), /already running/);
  while (jobs.current) await new Promise((resolve) => setTimeout(resolve, 20));
  const job = jobs.status();
  assert.equal(job.status, "failed");
  assert.match(job.log.map((entry) => entry.line).join("\n"), /active graph/);
  assert.throws(() => jobs.start({ type: "download", regions: ["nowhere"] }), /Unknown region/);
});
