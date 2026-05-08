# RogueRoute-GPX

Cyber Neon Wolf GPX route generation rebuilt as an OSRM-only routing system. The install flow remains the same style as the earlier pack while adding regional OSM downloads, prepared OSRM graphs, one-container region switching, GitHub update checks, and IITC plugin updates.

## Runtime pins

- Host/local build Node.js: `24.15.0`
- Docker web runtime: `node:24.15.0-alpine`
- pnpm: `10.33.4`
- Next.js / React web app via pnpm workspace
- Docker + Docker Compose
- OSRM backend container for routing

## Quick install

```bash
cd /opt/media-server/RogueRoute-GPX
nvm install 24.15.0
nvm use 24.15.0
bash install.sh osrm
```

## Download map extracts

```bash
./download-osm.sh list
./download-osm.sh core
# or:
./download-osm.sh australia
./download-osm.sh japan
./download-osm.sh europe
```

Every download is registered in `infra/docker/.env` as an `OSRM_REGION_*` entry, so first-run setup does not require manual `.env` editing.

## Prepare OSRM graphs

```bash
./prepare-osrm.sh region australia
./prepare-osrm.sh region japan
./prepare-osrm.sh all-downloaded
```

OSRM serves one active graph at a time. This avoids the RAM crash you hit while trying to process `planet.osm.pbf`.

## Switch active routing region

```bash
./switch-osrm-region.sh japan
```

The website also includes an OSRM Region Switcher. It updates `.env`, restarts only the OSRM service, waits for health, and keeps the web container running.

## Start

```bash
./deploy.sh osrm
```

Open:

```text
http://SERVER-IP:9080
```

## GitHub update check

```bash
./version-check.sh
./update.sh
```

## Release helper

```bash
./release.sh v10.0.0
```

## Notes on planet.osm.pbf

Planet preprocessing is still possible in theory, but it can require far more RAM/swap than a 128GB server has available, especially with `foot.lua`. For public use, this pack is designed around many regional extracts stored under `/mnt/h/osrm` and one active OSRM graph at a time.

## OSRM repair workflow

For first startup after interrupted map preparation, inspect and repair OSRM data without deleting downloaded `.osm.pbf` files:

```bash
./prepare-osrm.sh repair list
./prepare-osrm.sh repair 3
./prepare-osrm.sh repair all --yes
```

Repair moves stale/partial `.osrm*` outputs to `_osrm-backups/` before rebuilding. Ready graphs are skipped unless `--force` is supplied.

```bash
./prepare-osrm.sh repair all --force --yes
./prepare-osrm.sh cleanup-backups --days 14 --yes
```
