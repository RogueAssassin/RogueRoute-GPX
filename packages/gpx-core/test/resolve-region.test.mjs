import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveRegion } from "../dist/routing/resolve-region.js";

const catalog = JSON.parse(readFileSync(new URL("../../../regions.json", import.meta.url), "utf8")).regions;
const regions = (prepared) =>
  catalog.map((region) => ({ key: region.key, label: region.label, bounds: region.bounds, prepared: prepared.includes(region.key) }));

const melbourne = [{ lat: -37.8136, lng: 144.9631 }, { lat: -37.816, lng: 144.969 }];
const auckland = [{ lat: -36.8485, lng: 174.7633 }];
const berlin = [{ lat: 52.52, lng: 13.405 }];

test("catalog entries are well formed", () => {
  const keys = new Set();
  for (const region of catalog) {
    assert.match(region.key, /^[a-z0-9][a-z0-9-]*$/);
    assert.ok(!keys.has(region.key), `duplicate ${region.key}`);
    keys.add(region.key);
    assert.match(region.graph, /^[a-z0-9][a-z0-9-]*$/);
    assert.ok(region.url.startsWith("https://download.geofabrik.de/"));
    assert.ok(region.url.endsWith(`/${region.graph}-latest.osm.pbf`));
    assert.ok(region.bounds.length > 0);
    for (const [minLon, minLat, maxLon, maxLat] of region.bounds) {
      assert.ok(minLon < maxLon && minLat < maxLat, `${region.key} box is inverted`);
      assert.ok(minLon >= -180 && maxLon <= 180 && minLat >= -90 && maxLat <= 90);
    }
  }
});

test("picks the region containing all waypoints", () => {
  const result = resolveRegion(auckland, regions(["australia", "new-zealand"]), "australia");
  assert.equal(result.ok && result.region.key, "new-zealand");
});

test("prefers the active region, then the smallest one", () => {
  assert.equal(resolveRegion(berlin, regions(["europe", "germany"]), "europe").region.key, "europe");
  assert.equal(resolveRegion(berlin, regions(["europe", "germany"]), "australia").region.key, "germany");
  assert.equal(resolveRegion(melbourne, regions(["australia"]), undefined).region.key, "australia");
});

test("reports unprepared and unknown areas", () => {
  const unprepared = resolveRegion(auckland, regions(["australia"]), "australia");
  assert.equal(unprepared.ok, false);
  assert.equal(unprepared.reason, "not-prepared");
  assert.match(unprepared.message, /New Zealand/);

  const split = resolveRegion([...melbourne, ...auckland], regions(["australia", "new-zealand"]), "australia");
  assert.equal(split.reason, "outside-catalog");
  assert.equal(resolveRegion([], regions([]), undefined).reason, "no-waypoints");
});
