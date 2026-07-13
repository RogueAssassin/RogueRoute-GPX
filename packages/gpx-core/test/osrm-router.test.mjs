import assert from "node:assert/strict";
import test from "node:test";
import { OsrmRouter, OsrmRoutingError } from "../dist/routing/osrm-router.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const from = { id: "wharf", lat: -36.84, lng: 174.76, name: "Wharf" };
const to = { id: "city", lat: -36.85, lng: 174.77, name: "City" };
const request = {
  mode: "preserve-order",
  strictLandRouting: true,
  allowManualOverride: false,
};

test("strict routing progressively expands nearest-path searches", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const requested = [];
  let routeCalls = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url);

    if (url.pathname.includes("/route/")) {
      routeCalls += 1;
      if (routeCalls === 1) {
        return jsonResponse(
          { code: "NoSegment", message: "Could not find a matching segment" },
          400,
        );
      }
      return jsonResponse({
        code: "Ok",
        routes: [
          {
            distance: 1300,
            duration: 900,
            geometry: {
              type: "LineString",
              coordinates: [
                [174.761, -36.841],
                [174.77, -36.85],
              ],
            },
          },
        ],
      });
    }

    const radius = Number(url.searchParams.get("radiuses"));
    const isStart = url.pathname.includes(`${from.lng},${from.lat}`);
    if (isStart && radius === 100) {
      return jsonResponse(
        { code: "NoSegment", message: "Could not find a matching segment" },
        400,
      );
    }
    return jsonResponse({
      code: "Ok",
      waypoints: [
        {
          distance: isStart ? 140 : 10,
          location: isStart ? [174.761, -36.841] : [to.lng, to.lat],
        },
      ],
    });
  };

  const router = new OsrmRouter({
    baseUrl: "http://osrm:5000",
    profile: "foot",
    snapRadiusMeters: 100,
    snapMaxRadiusMeters: 400,
  });
  const plan = await router.route([from, to], request);

  assert.equal(plan.legs[0].overrideUsed, undefined);
  assert.equal(plan.legs[0].snappedFrom.distanceMeters, 140);
  assert.match(plan.warnings[0], /auto-snapped 140m/);
  const startRadii = requested
    .filter((url) => url.pathname.includes("/nearest/") && url.pathname.includes(`${from.lng},${from.lat}`))
    .map((url) => Number(url.searchParams.get("radiuses")));
  assert.deepEqual(startRadii, [100, 200]);
});

test("strict routing returns the failed waypoint after reaching the snap cap", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    jsonResponse(
      { code: "NoSegment", message: "Could not find a matching segment" },
      400,
    );

  const router = new OsrmRouter({
    baseUrl: "http://osrm:5000",
    profile: "foot",
    snapRadiusMeters: 100,
    snapMaxRadiusMeters: 400,
  });

  await assert.rejects(router.route([from, to], request), (error) => {
    assert.ok(error instanceof OsrmRoutingError);
    assert.equal(error.routingFailure.kind, "no-segment");
    assert.equal(error.routingFailure.waypointIndex, 0);
    assert.deepEqual(error.routingFailure.point, from);
    assert.deepEqual(error.routingFailure.attemptedSnapRadiiMeters, [100, 200, 400]);
    assert.match(error.message, /no direct segment was created/i);
    return true;
  });
});
