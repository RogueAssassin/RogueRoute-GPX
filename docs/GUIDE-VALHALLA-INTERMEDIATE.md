# Intermediate Guide: Valhalla Mode

Use this guide if you want land-aware routing and are comfortable managing routing data.

## What this mode is for
Valhalla mode adds more realistic road and path routing, but it also needs more storage, RAM, and setup care.

This mode is best for:
- intermediate self-hosters
- users with a home server or VPS with extra resources
- users who are comfortable storing `.osm.pbf` data outside the app folder

## Before you begin
Read `docs/SYSTEM-REQUIREMENTS.md` first.

You need:
- everything required for Standard mode
- Node.js 24.15.0
- Corepack 0.34.7
- pnpm 10.33.1
- port `8002` available
- a folder outside the repo for routing data
- one or more `.osm.pbf` files, or existing Valhalla tiles

## Step 1: Prepare a routing data folder
Use a folder outside the app folder so updates do not wipe your map data.

Examples:
```text
/opt/valhalla
/mnt/data/valhalla
/mnt/h/Valhalla
```

## Step 2: Add map data
Your data folder must contain one of these:
- one or more `.osm.pbf` files
- `valhalla_tiles.tar`
- a `valhalla_tiles` directory

For most users, regional `.osm.pbf` files are the best starting point.

## Step 3: Run first-time setup
```bash
bash ./fix-permissions.sh
bash ./first-run.sh
```

When asked which mode to use, choose **Valhalla**.

This creates:
```text
infra/docker/.env
```
from:
```text
infra/docker/.env.valhalla
```

## Step 4: Edit the environment file
Open `infra/docker/.env` and set your routing data path.

Example:
```env
ROUTER_MODE=valhalla
VALHALLA_URL=http://valhalla:8002
VALHALLA_DATA_PATH=/opt/valhalla
HOST_PORT=9080
PORT=9080
VALHALLA_PREFER_PBF_REBUILD=true
VALHALLA_SMART_REPAIR=true
```

## Step 5: Deploy Valhalla mode
```bash
./deploy-valhalla.sh
```

The script will:
- check for valid routing data
- create `media-net` if missing
- verify the Standard web app port and the Valhalla port
- build the app
- start both containers

## Step 6: Verify the services
```bash
./logs-valhalla.sh
curl -v http://127.0.0.1:8002/status
```

Then open:
```text
http://SERVER-IP:9080
```

## Restart after reboot or crash
```bash
./verify-valhalla.sh
./restart-valhalla.sh
```

## Repair a broken routing build
If Valhalla is stuck restarting or reports broken generated data:

```bash
./verify-valhalla.sh
./repair-valhalla.sh
./deploy-valhalla.sh
```

This keeps your `.osm.pbf` files but removes generated routing outputs so they can be rebuilt.

## Regional vs full-world guidance
### Regional builds
Good for most users.

Suggested baseline:
- 4 CPU cores
- 8 to 16 GB RAM
- 50 GB+ free disk

### Full-world builds
Only for powerful hosts.

Suggested baseline:
- 8 CPU cores or more
- 32 GB RAM minimum
- 64 GB RAM preferred
- 300 GB to 500+ GB free SSD space
