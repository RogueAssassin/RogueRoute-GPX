import assert from "node:assert/strict";
import test from "node:test";
import {
  flattenRoutePlanPoints,
  simplifyLine,
  simplifyRoutePlan,
} from "../dist/gpx/simplify-track.js";
import { buildGpxFromTrack } from "../dist/gpx/build-gpx.js";

test("simplifyLine removes straight-line noise and retains endpoints", () => {
  const points = Array.from({ length: 101 }, (_, index) => [
    -36.84,
    174.75 + index * 0.00001,
  ]);

  const simplified = simplifyLine(points, 1);

  assert.deepEqual(simplified, [points[0], points.at(-1)]);
});

test("simplifyLine retains a meaningful corner", () => {
  const points = [
    [-36.84, 174.75],
    [-36.84, 174.751],
    [-36.839, 174.751],
  ];

  assert.deepEqual(simplifyLine(points, 2.5), points);
});

test("automatic route simplification stays within the point budget", () => {
  const legs = Array.from({ length: 12 }, (_, legIndex) => {
    const geometry = Array.from({ length: 201 }, (_, pointIndex) => {
      const position = legIndex * 200 + pointIndex;
      return [
        -36.84 + Math.sin(position / 25) * 0.00008,
        174.75 + position * 0.00001,
      ];
    });
    return {
      from: { id: `from-${legIndex}`, lat: geometry[0][0], lng: geometry[0][1] },
      to: {
        id: `to-${legIndex}`,
        lat: geometry.at(-1)[0],
        lng: geometry.at(-1)[1],
      },
      distanceMeters: 1_000,
      durationSeconds: 700,
      geometry,
    };
  });

  const plan = {
    orderedWaypoints: [],
    legs,
    totalDistanceMeters: 12_000,
    totalDurationSeconds: 8_400,
    mode: "osrm",
    routeMode: "preserve-order",
    bounds: { minLat: -36.85, maxLat: -36.83, minLng: 174.75, maxLng: 174.78 },
  };
  const simplified = simplifyRoutePlan(plan, {
    detail: "auto",
    maxTrackPoints: 500,
    toleranceMeters: 1,
  });

  assert.ok(simplified.geometrySummary.trackPointCount <= 500);
  assert.equal(simplified.geometrySummary.withinPointLimit, true);
  assert.deepEqual(simplified.legs[0].geometry[0], legs[0].geometry[0]);
  assert.deepEqual(simplified.legs.at(-1).geometry.at(-1), legs.at(-1).geometry.at(-1));
});

test("full detail removes only invalid/consecutive duplicate points", () => {
  const shared = [-36.84, 174.751];
  const plan = {
    orderedWaypoints: [],
    legs: [
      {
        from: { id: "a", lat: -36.84, lng: 174.75 },
        to: { id: "b", lat: shared[0], lng: shared[1] },
        distanceMeters: 100,
        durationSeconds: 60,
        geometry: [[-36.84, 174.75], [-36.84, 174.75], shared],
      },
      {
        from: { id: "b", lat: shared[0], lng: shared[1] },
        to: { id: "c", lat: -36.839, lng: 174.751 },
        distanceMeters: 100,
        durationSeconds: 60,
        geometry: [shared, [-36.839, 174.751]],
      },
    ],
    totalDistanceMeters: 200,
    totalDurationSeconds: 120,
    mode: "osrm",
    routeMode: "preserve-order",
    bounds: { minLat: -36.84, maxLat: -36.839, minLng: 174.75, maxLng: 174.751 },
  };

  const simplified = simplifyRoutePlan(plan, { detail: "full" });

  assert.equal(flattenRoutePlanPoints(simplified).length, 3);
  assert.equal(simplified.geometrySummary.duplicateTrackPointCount, 2);
  assert.equal(simplified.geometrySummary.toleranceMeters, 0);
});

test("GPX output is compact, escaped, and de-duplicates adjacent points", () => {
  const gpx = buildGpxFromTrack(
    [
      [-36.8410334, 174.7682924],
      [-36.8410334, 174.7682924],
      [-36.842, 174.767],
    ],
    "Wharf & walking <route>",
  );

  assert.equal((gpx.match(/<trkpt /g) ?? []).length, 2);
  assert.match(gpx, /lat="-36\.841033" lon="174\.768292" \/>/);
  assert.match(gpx, /<name>Wharf &amp; walking &lt;route&gt;<\/name>/);
});
