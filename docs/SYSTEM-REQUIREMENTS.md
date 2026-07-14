# System Requirements

This page explains the lightweight v12 container requirements and the extra
tools required for source builds and OSRM preprocessing.

## Standalone GHCR deployment

The recommended production deployment needs Docker Engine, the Docker Compose
plugin, Bash, OpenSSL, port 9080, and access to the prepared OSRM data folder.
It does not need Node.js, pnpm, Git, the `media-net` network, or a Docker socket
mount. Browser access to `tile.openstreetmap.org` supplies the optional map
background.

## Supported software standard
Use these versions for a supported setup:

- **Node.js:** 24.18.0
- **Package manager:** pnpm 11.12.0
- **Package manager activation:** Corepack 0.35.0
- **Docker:** Docker Engine / CLI 29.4.1 with `docker compose`
- **Git:** needed for Git clone installs and Git-based updates

`npm install` is not the supported workspace install method for this project.

## Source/developer requirements

These are required when building the web image or running the workspace from
source.

### Software
- Docker Engine / CLI 29.4.1
- Docker Compose plugin (`docker compose`)
- Node.js 24.18.0
- Corepack 0.35.0
- pnpm 11.12.0
- Bash shell

### Network and ports
- TCP port `9080` free for the web app
- Docker permission to create a project network; the legacy source Compose
  stack can also use `media-net`
- Browser HTTPS access to `tile.openstreetmap.org` for the default interactive
  map background. Routing and GPX generation continue to work if tiles are
  unavailable; only the basemap is missing.

### Recommended host baseline
For a small self-hosted setup:
- **CPU:** 2 cores or more
- **RAM:** 4 GB minimum
- **Disk:** 10 GB free space minimum

This is enough for Standard mode in most home lab and VPS cases.

## Standard mode requirements
Standard mode is the simplest setup and the recommended starting point.

### Recommended for beginners
- **CPU:** 2 to 4 cores
- **RAM:** 4 GB minimum, 8 GB preferred
- **Disk:** 10 GB to 20 GB free space

### What Standard mode does not need
- No OSRM routing dataset
- No `.osm.pbf` downloads
- No extra OSRM port `5000`

## OSRM mode requirements
OSRM mode adds land-aware routing and external map data.

### Recommended for regional use
- **CPU:** 4 cores or more
- **RAM:** 8 GB minimum, 16 GB preferred
- **Disk:** 50 GB+ free space depending on region size
- **Port:** `5000` free for the OSRM service (or change `OSRM_HOST_PORT`)

### Recommended for full-world builds
- **CPU:** 8 cores or more
- **RAM:** 32 GB minimum, 64 GB preferred
- **Disk:** 300 GB to 500+ GB free SSD space

### OSRM data requirements
Your `OSRM_DATA_DIR` must contain a valid `.osm.pbf` input and the `.osrm*`
graph files produced by `prepare-osrm.sh` for the active region.


## Lockfile requirement for official releases
Official GitHub releases should commit `pnpm-lock.yaml` so installs are reproducible and support issues are easier to diagnose.


## Automated dependency installer

For Ubuntu/Debian or WSL2 Ubuntu hosts, run:

```bash
bash fix-permissions.sh
./install-dependencies.sh --yes
```

This installs the required base packages, Docker/Docker Compose, nvm, Node.js `24.18.0`, pnpm `11.12.0`, and creates the default OSRM data directory.
