import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MapRequests } from "./requests.mjs";
import { UpdateChecker } from "./updates.mjs";

async function dataDir(t) {
  const dir = await mkdtemp(join(tmpdir(), "rogueroute-gpx-requests-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("counts repeated requests, keeps short notes, and persists", async (t) => {
  const dir = await dataDir(t);
  const requests = new MapRequests({ dataDir: dir, log: () => {} });
  await requests.init();
  await requests.add({ id: "us/oregon", name: "Oregon", note: "Portland  walks\n" });
  await requests.add({ id: "us/oregon", name: "Oregon", note: "x".repeat(500) });
  await requests.add({ id: "us/texas", name: "Texas" });
  const oregon = requests.list()[0];
  assert.equal(oregon.id, "us/oregon");
  assert.equal(oregon.count, 2);
  assert.equal(oregon.notes[0].text, "Portland walks");
  assert.equal(oregon.notes[1].text.length, 200);
  assert.equal(requests.openCount, 2);

  await requests.resolve("us/texas", "dismissed");
  await requests.saving;
  const reloaded = new MapRequests({ dataDir: dir, log: () => {} });
  await reloaded.init();
  assert.equal(reloaded.openCount, 1);
  assert.equal(reloaded.requests.find((request) => request.id === "us/texas").status, "dismissed");
  // Asking again reopens it.
  await reloaded.add({ id: "us/texas", name: "Texas" });
  assert.equal(reloaded.openCount, 2);
  await assert.rejects(reloaded.resolve("nowhere", "approved"), (error) => error.code === "unknown-request");
});

test("reports newer Geofabrik data and queues regions older than the automatic age", async (t) => {
  const dir = await dataDir(t);
  const region = (key) => ({ key, label: key, url: `https://example.test/${key}.osm.pbf`, pbf: `${key}-latest.osm.pbf`, osrm: `${key}-latest.osrm` });
  const catalog = [region("old"), region("fresh"), region("absent")];
  await writeFile(join(dir, "old-latest.osm.pbf"), "x");
  await writeFile(join(dir, "fresh-latest.osm.pbf"), "x");
  const now = Date.now();
  const queued = [];
  const queue = {
    items: [],
    failures: {},
    history: {
      old: { dataDate: new Date(now - 40 * 86_400_000).toISOString() },
      fresh: { dataDate: new Date(now - 2 * 86_400_000).toISOString() },
    },
    act: async (request) => queued.push(request),
  };
  const fetchImpl = async () => new Response(null, { status: 200, headers: { "last-modified": new Date(now - 3_600_000).toUTCString(), "content-length": "42" } });
  const updates = new UpdateChecker({ catalog, dataDir: dir, queue, log: () => {}, checkDays: 0, autoDays: 30, fetchImpl });
  await updates.init();
  const result = await updates.check();
  assert.equal(result.regions.old.available, true);
  assert.equal(result.regions.fresh.available, true);
  assert.equal(result.regions.absent, undefined);
  assert.deepEqual(queued, [{ action: "update", regions: ["old"] }]);
  // Once updated, the download date moves past the server date.
  queue.history.old.dataDate = new Date(now).toISOString();
  assert.equal(updates.entry("old").available, false);
});
