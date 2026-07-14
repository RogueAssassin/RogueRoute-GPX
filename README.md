# RogueRoute GPX

RogueRoute GPX turns IITC, JSON, CSV, or coordinate lists into routed GPX files.
The production deployment is a standalone Docker Compose application using a
prebuilt GHCR web image and a local OSRM routing container.

Current release: **v12.1.0**

## What v12.1 provides

- Routes along OpenStreetMap roads, footways, and walking tracks.
- Automatically searches up to 5,000 m for a routable OSRM segment while
  keeping strict land routing enabled.
- Simplifies large route geometries to avoid GPX applications crashing while
  retaining route endpoints, leg boundaries, and meaningful bends.
- Displays the generated route, original waypoints, snapped points, and routing
  failures on an interactive OpenStreetMap preview.
- Downloads resumable Geofabrik extracts and prepares OSRM MLD graphs through
  Docker—no Node.js or pnpm installation is needed on the server.
- Runs on its own `rogueroute-gpx` Docker network. It is not part of Rogue
  Dashboard or any media-server Compose project.

## Requirements

- 64-bit Linux or ARM64 Linux
- Docker Engine with the `docker compose` plugin
- `curl`, `openssl`, and Bash
- Port `9080` for the web interface
- A storage directory for `.osm.pbf` and `.osrm*` files

## Install on a clean Linux server

```bash
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
sudo ./install.sh
```

The installer creates `/opt/rogueroute-gpx`, generates a persistent `.env`, and
starts `ghcr.io/rogueassassin/rogueroute-gpx:12.1.0` after a prepared OSRM graph
is available.

For a first installation, download and prepare a region before starting:

```bash
cd /opt/rogueroute-gpx
./rogueroute osm list
./rogueroute osm download new-zealand
./rogueroute osm prepare new-zealand
./rogueroute start
```

Open `http://SERVER-IP:9080`.

## Existing server using `/mnt/h/osrm`

```bash
sudo ./install.sh --path /opt/media-server/RogueRoute-GPX \
  --data-dir /mnt/h/osrm \
  --region new-zealand
```

The installer backs up an existing RogueRoute directory before replacing it.
It never removes the external OSRM data directory.

## Daily commands

```bash
./rogueroute start
./rogueroute stop
./rogueroute restart
./rogueroute status
./rogueroute logs
./rogueroute update
./rogueroute osm list
./rogueroute osm switch australia
```

Configuration lives in `.env`. The important defaults are:

```env
ROGUEROUTE_VERSION=12.1.0
OSRM_DATA_DIR=/mnt/h/osrm
OSRM_ACTIVE_REGION=australia
OSRM_SNAP_RADIUS_METERS=250
OSRM_SNAP_MAX_RADIUS_METERS=5000
GPX_MAX_TRACK_POINTS=1000
```

## Documentation

- [Installation](docs/INSTALL.md)
- [OSM downloads and OSRM preparation](docs/OSM.md)
- [Upgrading and rollback](docs/UPGRADING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [v12.1.0 release notes](docs/RELEASE-v12.1.0.md)

## Container images

- Web: `ghcr.io/rogueassassin/rogueroute-gpx:12.1.0`
- Router/tools: `osrm/osrm-backend:latest`

Publishing a GitHub Release tagged `v12.1.0` builds `12.1.0`, `12.1`, `12`,
`latest`, and immutable SHA tags automatically.
