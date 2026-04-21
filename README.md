# RogueRoute GPX v7.0.0

Cyber neon wolf edition of the GPX generator by RogueAssassin.

## Highlights
- redesigned v6 web UI
- strict land routing toggle
- explicit manual override warnings
- ferry toggle
- named GPX and debug downloads
- updated IITC exporter aligned with v7.0.0
- RogueAssassin branding and repo links
- Docker-ready Next.js deployment on port 9080
- documented Valhalla setup for Linux and WSL mounts
- regional/global map pack guidance for worldwide routing coverage
- root-level wrapper scripts for easier install, deploy, refresh, logs, status, and stop commands
- deployment preflight checks for env, ports, docker compose, media-net, and Valhalla data path

## Repo
`https://github.com/RogueAssassin/RogueRoute-GPX`

## Quick start
```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
cp infra/docker/.env.example infra/docker/.env
./install.sh
./deploy.sh
```

Open:
```text
http://SERVER-IP:9080
```

## Run with Valhalla
For land-aware routing and optional ferry support, start with the Valhalla override:

```bash
cd /opt/media-server/RogueRoute-GPX
cp infra/docker/.env.example infra/docker/.env  # first time only
./install.sh
./deploy-valhalla.sh
```

Required `infra/docker/.env` values:
```env
NEXT_PUBLIC_APP_NAME=RogueRoute GPX
ROUTER_MODE=valhalla
VALHALLA_URL=http://valhalla:8002
PORT=9080
HOST_PORT=9080
VALHALLA_DATA_PATH=/mnt/h/Valhalla
```

## Valhalla data path
Valhalla must have either one or more `.osm.pbf` files, a `valhalla_tiles.tar`, or a `valhalla_tiles` directory mounted into `/custom_files`.

For WSL with a Windows `H:` drive, the usual Linux path is:
```text
/mnt/h/Valhalla
```

Recommended regional packs for wide coverage:
- Australia-Oceania
- Europe
- North America
- Asia
- South America
- Africa
- Great Britain
- New Zealand

Example downloads:
```bash
cd /mnt/h/Valhalla
wget https://download.geofabrik.de/australia-oceania-latest.osm.pbf
wget https://download.geofabrik.de/europe-latest.osm.pbf
wget https://download.geofabrik.de/north-america-latest.osm.pbf
wget https://download.geofabrik.de/asia-latest.osm.pbf
wget https://download.geofabrik.de/south-america-latest.osm.pbf
wget https://download.geofabrik.de/africa-latest.osm.pbf
wget https://download.geofabrik.de/europe/great-britain-latest.osm.pbf
wget https://download.geofabrik.de/australia-oceania/new-zealand-latest.osm.pbf
```

If Valhalla cannot route a leg, v7.0.0 either:
- blocks the route when manual override is off
- marks the leg as a manual override when manual override is on

## Clean refresh on the server
If you want to repull the repo and remove stale files from older versions while **keeping your external Valhalla map data untouched**, use the new refresh wrappers from the repo root:

```bash
./refresh.sh
./refresh-valhalla.sh
```

What they do:
- stop the running containers
- fetch the latest Git changes
- hard reset to `origin/main`
- remove stale tracked and untracked files from the repo
- preserve `infra/docker/.env`
- rebuild and redeploy

Because `VALHALLA_DATA_PATH` points to a host path outside the repo such as `/mnt/h/Valhalla`, your map packs and built tiles stay in place.

## Safe manual refresh flow
If you prefer to do it yourself:

```bash
cd /opt/media-server/RogueRoute-GPX
./stop.sh
git fetch origin
git reset --hard origin/main
git clean -fdx -e infra/docker/.env -e infra/docker/.env.example
./install.sh
./deploy.sh
```

With Valhalla:
```bash
./deploy-valhalla.sh
```

## Wrapper commands
Run these from the repo root:

```bash
./install.sh
./deploy.sh
./deploy-valhalla.sh
./refresh.sh
./refresh-valhalla.sh
./update.sh
./status.sh
./logs.sh
./logs-valhalla.sh
./stop.sh
```

## IITC plugin
Main source plugin file:
```text
plugins/iitc/gpx-route-generator.user.js
```

Website download paths:
```text
/downloads/iitc/gpx-route-generator.user.js
/downloads/iitc/rogueroute-exporter.user.js
```

The userscript is configured for Tampermonkey update checks using `@version`, `@updateURL`, and `@downloadURL` metadata.

## Docs
- `docs/INSTALLATION.md`
- `docs/DOCKER-DEPLOYMENT.md`
- `docs/GITHUB-DESKTOP.md`
- `docs/IITC-SETUP.md`
- `docs/VALHALLA-SETUP.md`
- `docs/TROUBLESHOOTING.md`
- `CHANGELOG.md`
