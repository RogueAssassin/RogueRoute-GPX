# RogueRoute GPX v11

## Unreleased reliability improvements

- Updated the validated production toolchain to Node.js 24.18.0 LTS,
  Corepack 0.35.0, pnpm 11.12.0, Next.js 16.2.10, React/React DOM 19.2.7,
  and `@types/react` 19.2.17.
- Tested TypeScript 7.0.2 but retained TypeScript 6.0.3 because the current
  Next.js build worker does not yet recognise the TypeScript 7 installation
  correctly in this workspace.
- Retained `@types/node` 24.x so the type definitions continue to match the
  supported Node.js 24 runtime instead of crossing to the Node.js 26 types.
- Updated deploy/update ordering so newly pulled Node.js and pnpm requirements
  are reloaded before dependency installation.
- Fixed valid Geofabrik downloads being falsely rejected because `osmium`
  inferred an unknown format from the `.osm.pbf.part` suffix.
- Fixed completed modern OSRM MLD builds being falsely reported incomplete
  because the checker required obsolete `.osrm.nodes` output instead of
  `.osrm.nbg_nodes`; readiness now checks the current runtime sidecar set,
  including `.osrm.mldgr`, and prints every genuinely missing file.
- Added full PBF validation and automatic recovery of already-downloaded
  `.part.invalid-TIMESTAMP` files without another network transfer.
- Added automatic, compact, and full GPX geometry modes with path-preserving
  simplification, exact duplicate cleanup, configurable point limits, and UI
  point-count reporting.
- Added bounded adaptive OSRM nearest-path recovery (250m to 1500m by default)
  so strict-land routes can recover a distant portal without creating a manual
  direct segment; failures now identify the exact waypoint and radii tried.
- Replaced the schematic route preview with an interactive OpenStreetMap map
  showing routed legs, original waypoints, auto-snap corrections, and failed
  waypoint markers.
- Changed browser GPX downloads from large data URLs to Blob downloads.
- Added GPX core tests for endpoint/corner retention, duplicate removal, and
  adaptive point budgeting.
- Hardened OSM downloads with resume/retry behaviour, PBF validation, per-batch
  failure summaries, and continuation after individual region failures.
- Changed all-region OSRM preparation to back up/rebuild partial graphs,
  validate runtime sidecars, retry once with safe threads, and keep per-file
  build logs.
- Reworked the vanilla Ubuntu/Debian installation guide and added configurable
  `setup-env.sh --data-dir` support.

## v11 safe build hotfix

- Public version label is normalized to `v11` everywhere user-facing.
- Docker builds now repair `node_modules/.bin` executable permissions before `pnpm build`, fixing `next: Permission denied` and `tsc: Permission denied` failures.
- OSRM preprocessing now defaults to safer memory behaviour: `OSRM_THREADS=2`, `OSRM_SAFE_THREADS=1`, and `OSRM_FORCE_SAFE_BUILDS=true`.
- First-run and clean-rebuild flows now state whether they are running as a first-time install or a rebuild/update.
- OSRM builds validate required graph sidecars before reporting success.

# RogueRoute GPX v11

## v11 cleanup and OSRM stability release

- Public build label updated to `v11`; npm package versions use `11.0.0`.
- Added `./diagnose-osrm.sh` for OSRM graph validation, Compose status, and recent logs.
- Added OSRM runtime graph preflight checks to reduce confusing restart loops.
- Changed OSRM Compose restart policy to `on-failure:3` so missing/corrupt graphs do not loop forever.
- Kept dependency repair integrated before builds to recover from broken `node_modules` and non-executable `tsc`.
- Refreshed upgrade, OSRM recovery, and release documentation for v11.

# RogueRoute GPX v11

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
- Updated plugin version to `11.0.0`.

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

## Dependency installer update

- Added `install-dependencies.sh` for fresh Ubuntu/Debian and WSL2 Ubuntu hosts.
- Installer provisions build tools, Docker/Docker Compose, nvm, Node.js `24.15.0`, pnpm `11.0.8`, OSRM data directory setup, and safe host tuning.
- Updated README and setup docs so dependency installation is clearly part of the first-run flow.
- `first-run.sh` now honours a positional mode argument such as `./first-run.sh osrm` or `./first-run.sh standard`.

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


## Rev11.6

- Fixed `prepare-osrm.sh` so it never deletes downloaded `.osm.pbf` inputs.
- Changed forced OSRM rebuilds to move existing `.osrm*` files into `_osrm-backups/` instead of deleting them.
- Fixed `all-downloaded` so each discovered PBF is processed instead of resetting to the `.env` default.


## Rev11.7

- Fixed `prepare-osrm.sh all-downloaded` only preparing the env/default region.
- Prevented env reload from overwriting the selected PBF inside the all-downloaded loop.
- Added discovered-file listing and per-item progress logging.

## v11 - Workspace binary resolver hotfix

- Fixed installer dependency validation for pnpm workspace-local binaries.
- Next.js is now resolved from `apps/gpx-web/node_modules/next/dist/bin/next` first, with root fallback only if present.
- `apps/gpx-web` build/start/dev scripts call the app-local Next.js entrypoint directly with `node`, avoiding `.bin` shim execute-bit failures.
- TypeScript validation remains rooted at the workspace dev dependency for shared packages.
