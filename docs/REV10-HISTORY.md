# RogueRoute-GPX Rev10 consolidated history

This file replaces the old scattered `REV10.*` notes so the public repository has one clear changelog-style technical history.

## Rev10 OSRM-only cleanup
- Removed confusing mixed routing modes from the primary OSRM workflow.
- Standard/direct routing remains available only as a fallback/testing mode.
- Runtime pins were standardised around Node.js `24.15.0`, pnpm `11.0.8`, and TypeScript `6.0.3`.

## Rev10.3 TypeScript + OSRM path fix
- Kept TypeScript 6 support across the workspace.
- Tightened OSRM path handling so selected PBF/graph paths stay inside `OSRM_DATA_DIR`.
- Added safer defaults for regional OSRM preparation.

## Rev10.4 OSRM persistence fix
- Ensured `.osm.pbf` inputs and `.osrm*` prepared graph files live in the host-mounted OSRM data directory.
- Improved restart behavior so a rebuilt container can reuse prepared OSRM graphs.

## Rev10.5 startup and all-downloaded fix
- Added `all-downloaded` preparation mode to process every discovered `.osm.pbf` under `OSRM_DATA_DIR`.
- Improved startup checks and warnings when an OSRM graph has not been prepared yet.

## Rev10.6 no-delete prepare fix
- Preparation no longer deletes downloaded `.osm.pbf` inputs.
- Existing/partial `.osrm*` outputs are preserved unless the user explicitly supplies `--force`.

## Rev10.7 all-downloaded selection fix
- `all-downloaded` now processes files by their path relative to `OSRM_DATA_DIR`, rather than repeatedly falling back to the active region.
- Ready graphs are skipped and partial graphs are reported clearly.

## Rev10.9 all-downloaded definite fix
- Made recursive `.osm.pbf` discovery deterministic.
- Added clear counters for discovered, visited, skipped, and failed items.
- Continued processing later regions when one region fails.

## Rev10.10 advanced repair
- Added `repair list`, indexed repair selection, basename repair selection, and `repair all`.
- Partial `.osrm*` outputs are moved to `_osrm-backups/` before rebuilding.
- Added backup cleanup with `cleanup-backups --days <N> --yes`.

## v10.13 public release cleanup
- Added missing `infra/docker/.env.osrm` template.
- Removed committed runtime `infra/docker/.env` from the public package.
- Added `.gitignore` rules for env files, OSM downloads, OSRM graphs, and archives.
- Consolidated Rev10 notes into this single file.
- Added a clearer OSRM intermediate walkthrough for public GitHub users.
