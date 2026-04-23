# Changelog

## v8.0.0
- promoted the split guide system into the main README with direct markdown links for Standard, Valhalla, requirements, deployment, and troubleshooting
- added official environment template handling with `infra/docker/.env.standard` and `infra/docker/.env.valhalla` feeding first-run setup
- aligned the web UI title and landing page banner to `v8.0.0` so the app no longer shows legacy `v6` branding
- standardized the documented support baseline to Node.js 24.15.0, pnpm 10.33.1, Corepack 0.34.7, and Docker 29.4.1
- updated helper scripts and diagnostics to validate the new runtime standard more clearly
- kept Standard mode release-safe for ZIP installs and beginner-friendly docs while retaining the Valhalla intermediate workflow

## v7.6.0
- added Standard and Valhalla Enhanced install guidance across the README and docs
- added `restart.sh` and `restart-valhalla.sh` for safer reboot and crash recovery without pulling new code
- added `verify-valhalla.sh` to inspect existing Valhalla data and recommend the next action
- added `doctor.sh` for first-time-user and support diagnostics
- added Node.js 22 guidance and stronger Corepack/pnpm messaging for first-run workflows
- updated Valhalla documentation with regional `.osm.pbf` suggestions for common Pokémon GO play areas
- added a Valhalla container healthcheck in the compose override
- aligned package versions, health endpoint versioning, and IITC metadata to v7.6.0

## v7.5.0
- added smart Valhalla deployment planning based on the contents of `VALHALLA_DATA_PATH`
- made `deploy-valhalla.sh` and `refresh-valhalla.sh` prefer source `.osm.pbf` files over stale generated tiles when smart repair is enabled
- added `repair-valhalla.sh` to stop the container, remove broken generated tile outputs, and preserve source map files
- updated the Valhalla compose override to set `use_tiles_ignore_pbf=False`
- expanded README and setup docs with the new repair workflow and clearer beginner guidance
- aligned the IITC userscript metadata and release version to v7.5.0
