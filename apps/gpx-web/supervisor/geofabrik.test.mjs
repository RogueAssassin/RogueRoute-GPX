import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readStateFile } from "./catalog.mjs";
import { GeofabrikIndex, keyFor, parseIndex, regionContains } from "./geofabrik.mjs";

const square = (minLon, minLat, maxLon, maxLat) => [
  [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat],
  ],
];

const feature = (id, name, parent, file, rings) => ({
  type: "Feature",
  properties: { id, name, parent, urls: { pbf: `https://download.example/${file}-latest.osm.pbf` } },
  geometry: { type: "MultiPolygon", coordinates: rings.map((ring) => [ring]) },
});

// A tiny index: a country with two states, and a continent that is not in the catalog.
const INDEX = {
  type: "FeatureCollection",
  features: [
    feature("oceania", "Oceania", null, "oceania", square(100, -50, 180, 0)),
    feature("land", "Land", "oceania", "land", square(140, -40, 150, -30)),
    feature("land/north", "North Land", "land", "north-land", square(140, -35, 150, -30)),
    feature("land/south", "South Land", "land", "south-land", square(140, -40, 150, -35)),
  ],
};

async function serveIndex(t) {
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    if (req.method === "HEAD") {
      res.writeHead(200, { "content-length": "123456789" });
      return res.end();
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(INDEX));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  return { url: `${base}/index-v1.json`, base, requests: () => requests };
}

async function setup(t) {
  const dataDir = await mkdtemp(join(tmpdir(), "rogueroute-gpx-gf-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  // The built-in "land" region links to the index by its download file name.
  const catalog = [{ key: "land", label: "Land", group: "core", graph: "land", url: "https://elsewhere.example/land-latest.osm.pbf", bounds: [[140, -40, 150, -30]] }];
  const { url, base, requests } = await serveIndex(t);
  // Download URLs in the index point at download.example; send them to the local server.
  const fetchImpl = (target, options) => fetch(String(target).replace("https://download.example", base), options);
  const index = new GeofabrikIndex({ dataDir, catalog, log: () => {}, url, fetchImpl });
  return { dataDir, catalog, index, requests };
}

test("parses the index into outlines and keys", () => {
  const regions = parseIndex(INDEX);
  assert.equal(regions.length, 4);
  assert.deepEqual(regions[1].bbox, [140, -40, 150, -30]);
  assert.equal(keyFor("us/california"), "us-california");
  assert.equal(regionContains({ areas: regions[1].areas }, 145, -32), true);
  assert.equal(regionContains({ areas: regions[1].areas }, 155, -32), false);
});

test("downloads the index, caches it and links catalog regions", async (t) => {
  const { dataDir, catalog, index, requests } = await setup(t);
  await index.refresh();
  assert.equal(index.regions.length, 4);
  assert.equal(catalog[0].geofabrik, "land");
  assert.ok(catalog[0].areas.length);
  assert.deepEqual(index.children("land").map((region) => region.id).sort(), ["land/north", "land/south"]);

  // A second instance reads the cache instead of downloading again.
  const before = requests();
  const again = new GeofabrikIndex({ dataDir, catalog: [], log: () => {}, url: "http://127.0.0.1:9/unused" });
  await again.init();
  assert.equal(again.regions.length, 4);
  assert.equal(requests(), before);
});

test("adds a sub-region to the catalog, saves it and removes it again", async (t) => {
  const { dataDir, catalog, index } = await setup(t);
  await index.refresh();
  const size = await index.size("land/north");
  assert.equal(size, 123456789);
  const entry = await index.addToCatalog("land/north", size);
  assert.equal(entry.key, "land-north");
  assert.equal(entry.group, "added");
  assert.equal(entry.download, "123MB");
  assert.equal(entry.pbf, "land-north-latest.osm.pbf");
  assert.equal(catalog.length, 2);
  // Adding a region that is already in the catalog returns the existing entry.
  assert.equal((await index.addToCatalog("land")).key, "land");
  assert.equal(catalog.length, 2);

  const saved = await GeofabrikIndex.loadAdded(dataDir);
  assert.deepEqual(saved.map((region) => region.key), ["land-north"]);
  assert.ok((await readStateFile(dataDir, "regions.json")).regions[0].areas.length);

  // Covered by the prepared parent region.
  assert.deepEqual(index.coveredBy(index.get("land/north").bbox, [catalog[0]], "land-north").map((region) => region.key), ["land"]);
  assert.deepEqual(index.coveredBy(index.get("oceania").bbox, [catalog[0]]), []);

  await index.removeFromCatalog("land-north");
  assert.equal(catalog.length, 1);
  assert.deepEqual(await GeofabrikIndex.loadAdded(dataDir), []);
  await assert.rejects(index.removeFromCatalog("land"), /not an added region/);
});
