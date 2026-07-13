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
- Automatic GPX geometry cleanup that keeps walking-track shape while avoiding oversized exports
- Bounded adaptive waypoint snapping that stays on real OSRM paths without manual override
- Interactive OpenStreetMap route preview with waypoint, snap, and failure overlays
- Compact/full GPX detail choices with point-count reporting
- Safe repair workflow for partial/interrupted OSRM builds
- Region switching without rebuilding the web container

## Runtime pins

- Node.js: `24.18.0`
- Docker web runtime: `node:24.18.0-alpine`
- pnpm: `11.12.0`
- TypeScript: `6.0.3`
- Docker + Docker Compose
- Host dependency installer: `./install-dependencies.sh`


## Clean Linux quick start

On a vanilla Ubuntu/Debian server:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
./install-dependencies.sh --yes --osrm-dir /var/lib/rogueroute/osrm
newgrp docker
./setup-env.sh osrm --data-dir /var/lib/rogueroute/osrm
./first-run.sh osrm
./download-osm.sh new-zealand
./prepare-osrm.sh region new-zealand
./deploy.sh osrm
```

Open `http://SERVER-IP:9080`. The full step-by-step guide, including Standard
mode and troubleshooting, is in [`docs/INSTALLATION.md`](docs/INSTALLATION.md).

## Existing/custom server install path

```bash
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
./install-dependencies.sh --yes
./setup-env.sh osrm        # creates/reuses infra/docker/.env
./first-run.sh osrm
```

For a server/runtime-only checkout that avoids pulling docs/readmes/release notes onto the deployment machine, use sparse checkout:

```bash
git clone --filter=blob:none --no-checkout https://github.com/RogueAssassin/RogueRoute-GPX.git RogueRoute-GPX
cd RogueRoute-GPX
git sparse-checkout init --cone
git sparse-checkout set apps packages plugins infra scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc .nvmrc .node-version .dockerignore .gitignore VERSION first-run.sh install.sh install-dependencies.sh deploy.sh update.sh restart.sh refresh.sh status.sh stop.sh logs.sh doctor.sh download-osm.sh prepare-osrm.sh prepare-osm.sh switch-osrm-region.sh verify-osrm.sh fix-permissions.sh clean-web.sh clean-rebuild.sh repair-deps.sh repair-osm-builds.sh diagnose-osrm.sh version-check.sh setup-env.sh release.sh
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

On a normal Linux server, configure a native path directly:

```bash
./setup-env.sh osrm --data-dir /var/lib/rogueroute/osrm
```

Do **not** commit downloaded `.osm.pbf`, generated `.osrm*`, or `infra/docker/.env` files to GitHub.

## Prepare all downloaded regions

```bash
./prepare-osrm.sh all-downloaded --yes
```

This recursively processes every valid `.osm.pbf` under `OSRM_DATA_DIR`. It
skips ready graphs, automatically backs up/rebuilds partial graphs, retries a
failed build once with `OSRM_SAFE_THREADS`, and preserves all downloaded inputs.

## GPX point handling

`Automatic` is the recommended export detail. It removes exact duplicates and
uses a path-preserving 2.5 m simplification, increasing the tolerance only when
needed to aim for at most 1,000 track points. Every routed waypoint/leg boundary
is retained. `Compact` targets a smaller file; `Full` keeps the original OSRM
detail apart from duplicate cleanup.

The defaults can be tuned in `infra/docker/.env`:

```env
GPX_MAX_TRACK_POINTS=1000
GPX_SIMPLIFY_TOLERANCE_METERS=2.5
OSRM_SNAP_RADIUS_METERS=250
OSRM_SNAP_MAX_RADIUS_METERS=1500
```

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
./release.sh v11
```

## Notes on planet.osm.pbf

Planet preprocessing is possible in theory, but it can require far more RAM/swap than a typical server has available, especially with the foot profile. For public use, this repo is designed around regional extracts and one active OSRM graph at a time.
