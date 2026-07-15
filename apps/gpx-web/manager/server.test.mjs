import assert from "node:assert/strict";
import test from "node:test";
import { parseEnv, updateEnvText } from "./server.mjs";

test("manager parses deployment environment values", () => {
  assert.deepEqual(parseEnv("# comment\nOSRM_GRAPH=australia-latest.osrm\nHOST_PORT=9080\n"), {
    OSRM_GRAPH: "australia-latest.osrm",
    HOST_PORT: "9080",
  });
});

test("manager updates switch values without dropping unrelated configuration", () => {
  const updated = updateEnvText("HOST_PORT=9080\nOSRM_ACTIVE_REGION=australia\n", {
    OSRM_ACTIVE_REGION: "new-zealand",
    OSRM_GRAPH: "new-zealand-latest.osrm",
  });
  assert.equal(updated, "HOST_PORT=9080\nOSRM_ACTIVE_REGION=new-zealand\nOSRM_GRAPH=new-zealand-latest.osrm\n");
});
