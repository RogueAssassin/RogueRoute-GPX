# RogueRoute GPX v7.0.0

RogueRoute GPX is a beginner-friendly GPX route generator with IITC export support, optional Valhalla routing, and simple Docker deployment.

## What this project does
- builds GPX routes from waypoint lists and IITC exports
- supports a modern web UI on port `9080`
- supports optional Valhalla routing for land-aware paths
- keeps Valhalla map data outside the repo so updates do not wipe it
- includes easy root-level commands for install, deploy, logs, refresh, and stop

## Who this is for
This package is written so a first-time self-hoster can get it running with very little Linux or Docker experience.

## Fastest beginner setup
```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
bash first-run.sh
cp infra/docker/.env.example infra/docker/.env
nano infra/docker/.env
./deploy.sh
```

Open:
```text
http://SERVER-IP:9080
```

## If you want Valhalla routing
1. Put your Valhalla data on a host path outside the repo, for example `/mnt/h/Valhalla` on WSL.
2. Copy the Docker env file and set `VALHALLA_DATA_PATH=/mnt/h/Valhalla`.
3. Put your `.osm.pbf` files or built tiles in that folder.
4. Run:

```bash
./deploy-valhalla.sh
```

## Beginner command list
Run these from the repo root:

```bash
bash fix-permissions.sh
bash first-run.sh
./install.sh
./deploy.sh
./deploy-valhalla.sh
./refresh.sh
./refresh-valhalla.sh
./status.sh
./logs.sh
./logs-valhalla.sh
./stop.sh
```

## Full-world Valhalla planning
### Approximate planet download size
The current `planet-latest.osm.pbf` download is roughly **86 GB**. That is just the raw planet file and not the built routing tiles.

### Practical full-world storage estimate
For a comfortable full-world self-hosted Valhalla setup, plan for roughly:
- **86 GB** for the current planet `.pbf`
- **300 GB to 500+ GB** total free SSD space for build products, temporary files, tiles, and headroom

### Practical full-world system recommendation
This project recommends the following for a full-world build:
- **8 CPU cores** or more
- **32 GB RAM minimum**
- **64 GB RAM preferred** for smoother rebuilds and updates
- **500 GB+ SSD free space**

### Better choice for most people
For easier setup, use regional packs instead of the full planet file. Recommended packs:
- Australia-Oceania
- Europe
- North America
- Asia
- South America
- Africa
- Great Britain
- New Zealand

## Valhalla data path example for WSL
If your Windows drive is `H:\Valhalla`, the normal WSL path is:

```text
/mnt/h/Valhalla
```

## Safe repo refresh without deleting map data
Because Valhalla data lives outside the repo, you can refresh the project safely:

```bash
./refresh.sh
./refresh-valhalla.sh
```

These commands:
- stop the running containers
- fetch the latest Git changes
- reset to `origin/main`
- remove stale old-version files from the repo
- preserve `infra/docker/.env`
- leave `/mnt/h/Valhalla` alone

## Plugin
Main userscript file:

```text
plugins/iitc/gpx-route-generator.user.js
```

The plugin is set up for Tampermonkey update checks using userscript metadata.

## Main docs
- `docs/INSTALLATION.md`
- `docs/VALHALLA-SETUP.md`
- `docs/DOCKER-DEPLOYMENT.md`
- `docs/TROUBLESHOOTING.md`
- `docs/GITHUB-DESKTOP.md`
- `CHANGELOG.md`
