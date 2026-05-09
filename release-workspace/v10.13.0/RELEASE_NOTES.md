# RogueRoute GPX v10.13.0

## Priority fixes
- Fixed OSRM `NoSegment` route generation failures by adding automatic nearest-path snapping and one retry before failing.
- Increased default OSRM snapping radius from 150m to 250m.
- Added clearer waypoint error guidance when a coordinate cannot be routed or snapped.
- Kept manual override available as an explicit fallback instead of silently drawing direct lines.

## Performance and build improvements
- Updated pnpm pin to `11.0.8` through Corepack.
- Preserved the previous TypeScript 6-safe tsconfig layout to avoid earlier `baseUrl` and `rootDir` build failures.
- Added bounded in-memory route caching for repeated IITC/JSON payloads.
- Added parallel OSRM leg processing with `OSRM_MAX_PARALLEL_LEGS=6`.
- Kept the lightweight Next.js standalone production container.
- Disabled Next telemetry and production headers for smaller/faster runtime behavior.

## Website improvements
- Added `Install in Tampermonkey` button for the IITC plugin.
- Kept direct `Download IITC Plugin` button.
- Added route cache and auto-snap status indicators.
- Fixed fallback Australia graph name to `australia-latest.osrm`.

## IITC plugin
- Published the IITC userscript under web public paths:
  - `/downloads/iitc/rogueroute-exporter.user.js`
  - `/iitc/rogueroute.user.js`
- Updated plugin version to `10.13.0`.

## Environment changes
Add or confirm these values in `infra/docker/.env`:

```env
OSRM_SNAP_RADIUS_METERS=250
OSRM_MAX_PARALLEL_LEGS=6
ROUTE_CACHE_LIMIT=100
```

## Recommended upgrade commands

```bash
bash ./fix-permissions.sh
./first-run.sh

docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.osrm.yml down
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.osrm.yml build --no-cache gpx-web
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.osrm.yml up -d
```
