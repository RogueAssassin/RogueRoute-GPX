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


# Changelog

## Rev10.10 - OSRM advanced repair

- Added `./prepare-osrm.sh repair list` to show every downloaded `.osm.pbf` with `ready`, `partial`, or `missing` status.
- Added selectable repair by index, basename, relative path, or absolute path.
- Added `./prepare-osrm.sh repair all --yes` to repair every missing/partial graph while skipping ready graphs.
- Added `./prepare-osrm.sh cleanup-backups --days 14 --yes` for pruning old `_osrm-backups/` folders only.
- Preserved `.osm.pbf` inputs and moved stale `.osrm*` outputs to backups instead of deleting them.
- Kept Node.js `24.15.0-alpine`, Corepack, pnpm `11.0.8`, and TypeScript `^6.0.3`.

## v10.0.0

- Revamped package versioning to v10 while keeping the public webpage title as `RogueRoute-GPX`.
- Kept the V8 Cyber Neon Wolf visual direction in the rebuilt OSRM-first web app.
- Added webpage metadata title and SVG favicon.
- Enforced Node.js `24.15.0`, Docker `node:24.15.0-alpine`, and pnpm `11.0.8`.
- Added regional `.osm.pbf` downloader catalogue with automatic `.env` registration.
- Added one-container OSRM region switching with `switch-osrm-region.sh`.
- Added web OSRM Region Switcher that can restart only the OSRM service.
- OSRM-only deployment cleanup with stale web artifact cleanup on stop/restart.

## v9.0.0

- Rebuilt RogueRoute-GPX V8 into V9.
- Removed non-OSRM services and scripts.
- Added OSRM routing, OSRM prepare/verify scripts, and Docker compose overlay.
- Added `/mnt/h/osrm` support for local `.osm.pbf` storage.
- Updated web UI wording and health metadata to V9.
- Updated IITC plugin to v9.0.0 with faction-aware Alt-click legend.
- Added GitHub version checker and release tag helper.
- Updated pnpm target from 11.0.8 to 11.0.8.


## v9.0.1 - Neon Wolf OSRM regional refresh

- Restored the V8 Cyber Neon Wolf visual direction in the V9 web UI.
- Pinned Node.js to `24.15.0` and Docker web images to `node:24.15.0-alpine`.
- Updated pnpm from `11.0.8` to `11.0.8`.
- Added regional OSM downloader for Australia, New Zealand, Japan, China, popular Asia-Pacific regions, America/Hawaii, Canada, Mexico, South America, and Europe.
- Added `OSRM_THREADS=8` default for safer preprocessing on large extracts.
- Added region-aware `./prepare-osrm.sh region <key>`, local `./prepare-osrm.sh pbf <file>`, and `./prepare-osrm.sh all-downloaded` support.


## Rev10.6

- Fixed `prepare-osrm.sh` so it never deletes downloaded `.osm.pbf` inputs.
- Changed forced OSRM rebuilds to move existing `.osrm*` files into `_osrm-backups/` instead of deleting them.
- Fixed `all-downloaded` so each discovered PBF is processed instead of resetting to the `.env` default.


## Rev10.7

- Fixed `prepare-osrm.sh all-downloaded` only preparing the env/default region.
- Prevented env reload from overwriting the selected PBF inside the all-downloaded loop.
- Added discovered-file listing and per-item progress logging.
