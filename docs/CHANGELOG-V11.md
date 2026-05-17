# v11 changelog

## Build/version cleanup

- Public build label is now `v11`.
- Workspace/package versions are now `11.0.0` for npm compatibility.
- Docker build args and env templates now default to the v11 public app version.
- Health/build endpoints report the new version.

## Rebuild reliability

- Clean rebuild continues to remove stale Next.js build artifacts before Docker rebuilds.
- Dependency repair remains wired into local builds to handle missing or non-executable `tsc`.
- The stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` remains auto-generated and persisted in `infra/docker/.env`.

## OSRM reliability

- Added runtime graph validation for the configured `OSRM_GRAPH`.
- Added `./diagnose-osrm.sh` for a single-command OSRM health/log check.
- OSRM no longer restarts forever by default; Compose now limits failure retries with `restart: on-failure:3`.
- Guides now point users to `prepare-osrm.sh repair list` and `repair-osm-builds.sh` for partial `.osm.pbf` builds.

## Operator guidance

- Added `docs/V11-UPGRADE-GUIDE.md`.
- Added `docs/releases/v11.md`.
- Added this focused v11 changelog.
