# Installation

rogueroute-gpx runs as one container. The host needs Docker or Podman with Compose, Git,
Bash and OpenSSL. It does not need Node.js, pnpm, curl or the OSRM tools: those are inside
the image.

## Docker (Ubuntu or Debian)

Install Docker Engine and the Compose plugin from Docker's instructions, then check:

```bash
docker version
docker compose version
```

Add your account to the `docker` group (`sudo usermod -aG docker "$USER"`, then log in again)
so day-to-day commands do not need `sudo`.

## Rootless Podman

Install Podman and a Compose provider (`podman compose` works with either `podman-compose`
or Docker Compose). Run everything as your normal account, never with `sudo`. The script adds
`compose.podman.yaml`, which sets `userns_mode: keep-id` so files the container writes in the
map folder are owned by you. No Podman API socket is needed.

## Install

```bash
sudo install -d -o "$USER" -g "$(id -gn)" /opt/media-server/rogueroute-gpx
git clone https://github.com/RogueAssassin/rogueroute-gpx.git /opt/media-server/rogueroute-gpx
cd /opt/media-server/rogueroute-gpx
./install.sh --data-dir /mnt/h/osrm --region new-zealand --start
```

`install.sh` configures the checkout it runs from:

- creates `.env` from `.env.example` (mode 600) and pins `ROGUEROUTE_VERSION` to `VERSION`
- sets `PUID`/`PGID` to your account and `OSRM_DATA_DIR`/`OSRM_ACTIVE_REGION` from the flags
- with `--start`: starts the container, then downloads and prepares the region unless it is
  already prepared

Use `sudo ./install.sh` only if the map folder must be created somewhere your account cannot
write (Docker only); it hands ownership back to you.

The website comes up immediately. OSRM loads the graph in the background; large graphs can
take minutes (`ROGUEROUTE_STARTUP_TIMEOUT_SECONDS`, default 600). `./rogueroute-gpx osm status`
shows progress.

## Environment

Edit `/opt/media-server/rogueroute-gpx/.env`; never commit it. Notable settings:

- `ROGUEROUTE_RUNTIME=auto` selects a running engine: Podman first, or Docker first as root.
- `HOST_BIND=127.0.0.1` when a reverse proxy on the same host is the only client.
- `ADMIN_TOKEN` enables map download and preparation from the website (Map region panel →
  Map administration). Leave it empty to keep that to the CLI.
- `OSRM_SWITCH_COOLDOWN_SECONDS` limits how often visitors' routes can change the region.

The container runs as `PUID:PGID` with a read-only root filesystem, no capabilities and
`no-new-privileges`. Only `/data` (your map folder) and two tmpfs mounts are writable.

## Rogue Dashboard

The container joins the external `rogueroute-gpx` and `media-net` networks and answers as
both `rogueroute-gpx` and `rogueroute-gpx-web`, so Rogue Dashboard settings from v12 keep
working:

```dotenv
RGDASH_EXTRA_NETWORK=rogueroute-gpx
RGDASH_ROGUEROUTE_URL=https://gpx.example.com
```

## Uninstall

```bash
cd /opt/media-server/rogueroute-gpx
./rogueroute-gpx stop
sudo mv /opt/media-server/rogueroute-gpx /opt/media-server/rogueroute-gpx-removed
```

Map data in `OSRM_DATA_DIR` is not removed.
