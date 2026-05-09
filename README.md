# RogueRoute-GPX

RogueRoute-GPX is a self-hosted GPX route generator with a Next.js web UI, IITC exporter plugin, and optional local OSRM routing for road/path-following routes.

The project is designed for two audiences:

- **Standard mode:** easiest install, direct/fallback routing only.
- **OSRM mode:** recommended for real use, uses downloaded OpenStreetMap extracts and a local OSRM container.

## What you get

- Web app on `http://SERVER-IP:9080`
- IITC plugin export/handoff support
- OSRM region downloads through `download-osm.sh`
- OSRM graph preparation through `prepare-osrm.sh`
- Safe repair workflow for partial/interrupted OSRM builds
- Region switching without rebuilding the web container

## Runtime pins

- Node.js: `24.15.0`
- Docker web runtime: `node:24.15.0-alpine`
- pnpm: `11.0.8`
- TypeScript: `6.0.3`
- Docker + Docker Compose

## Public GitHub install path

```bash
git clone https://github.com/YOUR-USER/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
./setup-env.sh osrm        # copies infra/docker/.env.osrm to infra/docker/.env
./first-run.sh osrm
```

For a server/runtime-only checkout that avoids pulling docs/readmes/release notes onto the deployment machine, use sparse checkout:

```bash
git clone --filter=blob:none --no-checkout https://github.com/RogueAssassin/RogueRoute-GPX.git RogueRoute-GPX
cd RogueRoute-GPX
git sparse-checkout init --cone
git sparse-checkout set apps packages plugins infra scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc .nvmrc .node-version .dockerignore .gitignore VERSION first-run.sh install.sh deploy.sh update.sh restart.sh refresh.sh status.sh stop.sh logs.sh doctor.sh download-osm.sh prepare-osrm.sh prepare-osm.sh switch-osrm-region.sh verify-osrm.sh fix-permissions.sh clean-web.sh version-check.sh setup-env.sh release.sh
git checkout
bash fix-permissions.sh
```

`./update.sh` keeps this runtime-only sparse checkout refreshed by default. Set `ROGUEROUTE_FULL_CHECKOUT=true ./update.sh` only when you intentionally want docs locally.

For OSRM mode, the usual first setup flow is:

```bash
./setup-env.sh osrm
./download-osm.sh list
./download-osm.sh australia
./prepare-osrm.sh region australia
./deploy.sh osrm
```

For direct fallback/testing mode:

```bash
./deploy.sh standard
```

## OSRM data folder

By default OSRM data lives at:

```text
/mnt/h/osrm
```

Change `OSRM_DATA_DIR` in `infra/docker/.env` after first run if your map drive is elsewhere. `gpx-web` connects to OSRM at `http://osrm:5000` using the Docker Compose service name. The OSRM container is still named `rogueroute-osrm` for Dozzle/logs.

Do **not** commit downloaded `.osm.pbf`, generated `.osrm*`, or `infra/docker/.env` files to GitHub.

## Prepare all downloaded regions

```bash
./prepare-osrm.sh all-downloaded --yes
```

This recursively processes every `.osm.pbf` under `OSRM_DATA_DIR`. It skips ready graphs and preserves inputs.

## Repair interrupted OSRM builds

```bash
./prepare-osrm.sh repair list
./prepare-osrm.sh repair 3
./prepare-osrm.sh repair all --yes
```

Use force only when you intentionally want to move stale `.osrm*` files into `_osrm-backups/` and rebuild:

```bash
./prepare-osrm.sh repair all --force --yes
./prepare-osrm.sh cleanup-backups --days 14 --yes
```

## Region switching

```bash
./switch-osrm-region.sh japan
```

The web app also includes an OSRM Region Switcher. It updates `infra/docker/.env`, restarts only the OSRM service, waits for health, and keeps the web container running.

## Documentation

Start here:

- `docs/INSTALLATION.md`
- `docs/GUIDE-STANDARD-BEGINNER.md`
- `docs/GUIDE-OSRM-INTERMEDIATE.md`
- `docs/OSM-REGIONS.md`
- `docs/OSRM_SETUP.md`
- `docs/TROUBLESHOOTING.md`
- `docs/REV10-HISTORY.md`

## Release helper

```bash
./release.sh v10.13.0
```

## Notes on planet.osm.pbf

Planet preprocessing is possible in theory, but it can require far more RAM/swap than a typical server has available, especially with the foot profile. For public use, this repo is designed around regional extracts and one active OSRM graph at a time.
