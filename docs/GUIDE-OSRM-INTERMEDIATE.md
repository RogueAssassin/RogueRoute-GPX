# OSRM intermediate setup guide

Use this guide when you want high-quality GPX generation that follows roads, paths, sidewalks, and footways using local OpenStreetMap data.

## 1. Clone and enter the repo

```bash
git clone https://github.com/YOUR-USER/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
```

## 2. Install host requirements

Install these before continuing:

- Docker Engine with `docker compose`
- Node.js `24.15.0`
- Corepack/pnpm `11.0.8`
- Enough disk space for your selected OSM extracts and prepared OSRM graphs

Recommended Node setup with nvm:

```bash
nvm install 24.15.0
nvm use 24.15.0
corepack enable
corepack prepare pnpm@11.0.8 --activate
```

## 3. Create the environment file

```bash
./first-run.sh
```

Choose `OSRM` when prompted. This creates `infra/docker/.env` from `infra/docker/.env.osrm`.

Edit these values if needed:

```text
HOST_PORT=9080
OSRM_DATA_DIR=/mnt/h/osrm
OSRM_PROFILE=foot
OSRM_THREADS=8
```

## 4. Download a map extract

List available regions:

```bash
./download-osm.sh list
```

Download a region:

```bash
./download-osm.sh australia
```

Core starter set:

```bash
./download-osm.sh core
```

## 5. Prepare the OSRM graph

Prepare one region:

```bash
./prepare-osrm.sh region australia
```

Prepare every `.osm.pbf` already downloaded under `OSRM_DATA_DIR`:

```bash
./prepare-osrm.sh all-downloaded --yes
```

Preparation can take a long time and use significant RAM/disk depending on the region.

## 6. Deploy

```bash
./deploy.sh osrm
```

Open:

```text
http://SERVER-IP:9080
```

## 7. Verify and troubleshoot

```bash
./status.sh
./logs.sh
./verify-osrm.sh
```

If a build was interrupted:

```bash
./prepare-osrm.sh repair list
./prepare-osrm.sh repair 3
```

If a graph is partial and must be rebuilt:

```bash
./prepare-osrm.sh repair 3 --force --yes
```

## 8. Switch regions

Prepare the target region first, then run:

```bash
./switch-osrm-region.sh japan
```

Only one OSRM graph is served at a time. Switching changes the active graph and restarts the OSRM container, not the whole stack.
