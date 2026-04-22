# RogueRoute GPX v7.6.0

RogueRoute GPX is a beginner-friendly GPX route generator with IITC export support, a web UI on port `9080`, and an optional Valhalla Enhanced mode for land-aware routing.

## Choose your install type

### RogueRoute-GPX (Standard)
The base install is the best starting point for most users. It gives you:
- the core RogueRoute GPX web app
- GPX generation from waypoint lists and IITC exports
- simpler Docker deployment
- lower storage and RAM requirements
- the easiest path for first-time users

### RogueRoute-GPX (Valhalla Enhanced)
The enhanced install is for users who want more realistic routing. It gives you:
- Valhalla-backed routing
- support for reusable regional or full-world map data stored outside the repo
- better route realism for roads and paths
- repair, verify, refresh, and rebuild workflows for routing data
- higher storage, CPU, and RAM requirements than Standard mode

## Quick start

### Standard
```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
bash first-run.sh
nano infra/docker/.env
./deploy.sh
```

Open:
```text
http://SERVER-IP:9080
```

### Valhalla Enhanced
1. Set `VALHALLA_DATA_PATH` in `infra/docker/.env` to a folder outside the repo, for example `/mnt/h/Valhalla` on WSL.
2. Put one or more `.osm.pbf` files or existing Valhalla tiles in that folder.
3. Run:

```bash
./deploy-valhalla.sh
```

## Crash and reboot recovery
Use restart commands after a reboot or crash. These do not pull Git or rebuild the workspace.

### Standard
```bash
./restart.sh
./status.sh
./logs.sh
```

### Valhalla Enhanced
```bash
./verify-valhalla.sh
./restart-valhalla.sh
./logs-valhalla.sh
curl -v http://127.0.0.1:8002/status
```

If Valhalla tiles or config become corrupted after a crash:

```bash
./repair-valhalla.sh
./deploy-valhalla.sh
```

## First-run dependency behaviour
RogueRoute GPX supports Node.js `22` for local install/build tasks.

If `corepack` is available, the helper scripts try to activate the pinned pnpm version on first run. If pnpm is still missing, install it manually and rerun `./install.sh`.

> `pnpm-lock.yaml` is not included in this offline packaging build. Generate it on a connected machine with `pnpm install --lockfile-only` before publishing the release if you want fully pinned dependency resolution.

## Valhalla guidance for map files
Most users should start with regional `.osm.pbf` files instead of the full planet file.

Good starting regions for active Pokémon GO play areas:
- **Australia / New Zealand:** `australia-oceania-latest.osm.pbf`, optional `new-zealand-latest.osm.pbf`
- **UK / Europe:** `europe-latest.osm.pbf`, optional `europe/great-britain-latest.osm.pbf`
- **North America:** `north-america-latest.osm.pbf`
- **Asia:** `asia-latest.osm.pbf`
- **South America:** `south-america-latest.osm.pbf`
- **Africa:** `africa-latest.osm.pbf`

Start with the places you actually play in, confirm routing works, then add more regions only if needed.

## Full-world Valhalla planning
### Approximate planet download size
The current `planet-latest.osm.pbf` download is roughly **86 GB**.

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

## Beginner command list
Run these from the repo root:

```bash
bash fix-permissions.sh
bash first-run.sh
./install.sh
./deploy.sh
./deploy-valhalla.sh
./restart.sh
./restart-valhalla.sh
./verify-valhalla.sh
./doctor.sh
./repair-valhalla.sh
./refresh.sh
./refresh-valhalla.sh
./status.sh
./logs.sh
./logs-valhalla.sh
./stop.sh
```

## Main docs
- `docs/INSTALLATION.md`
- `docs/VALHALLA-SETUP.md`
- `docs/DOCKER-DEPLOYMENT.md`
- `docs/COMMANDS.md`
- `docs/TROUBLESHOOTING.md`
- `docs/SYSTEMD-SERVICE.md`
- `docs/GITHUB-DESKTOP.md`
- `CHANGELOG.md`
