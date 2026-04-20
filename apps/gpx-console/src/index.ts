import { generateRoute } from "@rogue/gpx-core";

async function main() {
  const result = await generateRoute({
    rawWaypoints: [
      { lat: -37.8136, lng: 144.9631, name: "Start" },
      { lat: -37.8140, lng: 144.9650, name: "Portal A" },
      { lat: -37.8152, lng: 144.9671, name: "Portal B" },
      { lat: -37.8160, lng: 144.9690, name: "Portal C" }
    ],
    request: {
      mode: "optimize-middle",
      keepStartFixed: true,
      keepEndFixed: true,
      name: "Console Test Route"
    },
    env: {
      ROUTER_MODE: process.env.ROUTER_MODE,
      VALHALLA_URL: process.env.VALHALLA_URL
    }
  });

  console.log("Route stats:");
  console.log(JSON.stringify(result.stats, null, 2));
  console.log("");
  console.log(result.gpx);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
