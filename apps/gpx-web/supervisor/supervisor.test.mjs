import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileState, readState, readStateFile, writeStateFile } from "./catalog.mjs";
import { OsrmService } from "./osrm.mjs";
import { MapQueue } from "./queue.mjs";

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

async function fixture(t, { cooldownMs = 0, prepared = ["alpha", "beta", "broken"] } = {}) {
  const root = await mkdtemp(join(tmpdir(), "rogueroute-gpx-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataDir = join(root, "data");
  const binDir = join(root, "bin");
  await Promise.all([mkdir(dataDir), mkdir(binDir)]);
  await writeFile(join(binDir, "osrm-routed"), FAKE_ROUTED);
  await chmod(join(binDir, "osrm-routed"), 0o755);
  const catalog = [region("alpha"), region("beta"), region("broken"), region("missing")];
  for (const key of prepared) {
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


// Stand-ins for the OSRM build tools. The "extract" content of a .osm.pbf steers them:
// "oom" kills osrm-extract with SIGKILL, "slow" makes it take a few seconds.
const FAKE_EXTRACT = `#!/usr/bin/env node
const fs = require("node:fs");
const pbf = process.argv.at(-1);
const content = fs.readFileSync(pbf, "utf8");
if (content.includes("oom")) process.kill(process.pid, "SIGKILL");
const finish = () => { fs.writeFileSync(pbf.replace(/\.osm\.pbf$/, ".osrm.ebg"), "x"); console.log("[info] extracted " + pbf); };
if (content.includes("slow")) setTimeout(finish, 5000); else finish();
`;
const FAKE_PARTITION = `#!/usr/bin/env node
require("node:fs").writeFileSync(process.argv.at(-1) + ".partition", "x");
`;
const FAKE_CUSTOMIZE = `#!/usr/bin/env node
const fs = require("node:fs");
for (const suffix of ["mldgr", "cell_metrics"]) fs.writeFileSync(process.argv.at(-1) + "." + suffix, "x");
`;

async function queueFixture(t, { pbfs = {}, catalogExtra = [], autoPrepare = true } = {}) {
  const base = await fixture(t, { prepared: [] });
  for (const [name, body] of Object.entries({ "osrm-extract": FAKE_EXTRACT, "osrm-partition": FAKE_PARTITION, "osrm-customize": FAKE_CUSTOMIZE })) {
    await writeFile(join(base.binDir, name), body);
    await chmod(join(base.binDir, name), 0o755);
  }
  for (const [key, content] of Object.entries(pbfs)) {
    base.catalog.push(region(key));
    await writeFile(join(base.dataDir, `${key}-latest.osm.pbf`), content);
  }
  base.catalog.push(...catalogExtra);
  const logs = [];
  const queue = new MapQueue({ ...base, profilesDir: base.binDir, profile: "foot", niceness: 0, autoPrepare, log: (line) => logs.push(line) });
  t.after(() => queue.stop());
  await base.osrm.boot("");
  return { ...base, queue, logs };
}

async function idle(queue) {
  for (let i = 0; i < 500 && (queue.current || queue.items.length || !queue.ready); i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(queue.current, null, "queue did not finish");
}

test("auto-prepares downloaded regions smallest first and loads the first one", async (t) => {
  const { osrm, queue, dataDir, logs } = await queueFixture(t, { pbfs: { gamma: "xxxxxxxx", delta: "x" } });
  assert.equal(osrm.status().state, "no-graph");
  await queue.init();
  await idle(queue);
  const order = logs.filter((line) => /\[OK\] (gamma|delta) is prepared/.test(line));
  assert.match(order[0], /delta/);
  assert.match(order[1], /gamma/);
  assert.equal(osrm.status().region, "delta");
  assert.equal(await fileState(dataDir, region("gamma")), "prepared");
  const saved = await readStateFile(dataDir, "queue.json");
  assert.deepEqual(saved.items, []);
  assert.ok(saved.history.gamma.preparedAt);
});

test("records an out-of-memory failure, keeps going, and retries on request", async (t) => {
  const { queue, dataDir } = await queueFixture(t, { pbfs: { gamma: "oom", delta: "xx" } });
  await queue.init();
  await idle(queue);
  assert.match(queue.failures.gamma.message, /out of memory/);
  assert.equal(queue.failures.gamma.step, "extract");
  assert.equal(await fileState(dataDir, region("delta")), "prepared");

  // A failed region is not queued again automatically after a restart...
  const restarted = new MapQueue({ ...queue, log: () => {} });
  await restarted.init();
  assert.equal(restarted.items.length, 0);
  // ...but retry queues it, and it succeeds once the cause is fixed.
  await writeFile(join(dataDir, "gamma-latest.osm.pbf"), "fixed");
  await restarted.act({ action: "retry" });
  await idle(restarted);
  assert.deepEqual(restarted.failures, {});
  assert.equal(await fileState(dataDir, region("gamma")), "prepared");
});

test("cancel stops the task in progress without recording a failure", async (t) => {
  const { queue, dataDir } = await queueFixture(t, { pbfs: { gamma: "slow" }, autoPrepare: false });
  await queue.init();
  await queue.act({ action: "add", regions: ["gamma"] });
  while (queue.current?.step !== "extract") await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(await queue.cancel(), "gamma");
  await idle(queue);
  assert.deepEqual(queue.failures, {});
  assert.equal(await fileState(dataDir, region("gamma")), "downloaded");
  await assert.rejects(queue.act({ action: "add", regions: ["nowhere"] }), /Unknown region/);
});

test("resumes a saved download, checks the MD5 and prepares when asked", async (t) => {
  const body = Buffer.alloc(2 * 1024 * 1024, 7);
  const md5 = createHash("md5").update(body).digest("hex");
  const server = createHttpServer((req, res) => {
    if (req.url.endsWith(".md5")) return res.end(`${md5}  epsilon-latest.osm.pbf\n`);
    const start = Number(/bytes=(\d+)-/.exec(req.headers.range ?? "")?.[1] ?? 0);
    res.writeHead(start ? 206 : 200, { "content-length": body.length - start });
    res.end(body.subarray(start));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/epsilon-latest.osm.pbf`;
  const epsilon = { ...region("epsilon"), url, download: "2MB" };
  const { queue, dataDir } = await queueFixture(t, { catalogExtra: [epsilon], autoPrepare: false });

  // Simulate a restart part way through: half the file on disk and the task saved in the queue.
  await writeFile(join(dataDir, "epsilon-latest.osm.pbf.part"), body.subarray(0, 1024 * 1024));
  await writeStateFile(dataDir, "queue.json", { items: [{ region: "epsilon", goal: "downloaded", addedAt: new Date().toISOString() }] });
  await queue.init();
  await idle(queue);
  assert.equal((await stat(join(dataDir, "epsilon-latest.osm.pbf"))).size, body.length);
  assert.deepEqual(await readFile(join(dataDir, "epsilon-latest.osm.pbf")), body);
  assert.equal(await fileState(dataDir, epsilon), "downloaded");

  await queue.act({ action: "add", regions: ["epsilon"] });
  await idle(queue);
  assert.equal(await fileState(dataDir, epsilon), "prepared");
});
