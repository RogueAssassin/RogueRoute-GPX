# Installation

RogueRoute GPX v12.5.0 is installed as an independent Docker Compose project.
It does not require Node.js, pnpm, a dashboard stack or an external Docker
network. The public web container has no Docker access. A private manager
sidecar mounts `/var/run/docker.sock` only so it can recreate OSRM after an
authenticated website region switch.

## Vanilla Ubuntu or Debian

Install Docker Engine and the Compose plugin using Docker's official
instructions, then verify:

```bash
docker version
docker compose version
```

Clone RogueRoute directly into its permanent location. Creating the directory
as the administrator account keeps future `git pull` commands free of `sudo`:

```bash
sudo install -d -o "$USER" -g "$(id -gn)" /opt/media-server/RogueRoute-GPX
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git /opt/media-server/RogueRoute-GPX
cd /opt/media-server/RogueRoute-GPX
sudo ./install.sh --data-dir /mnt/h/osrm --region new-zealand
```

The installer configures the Git checkout it is run from. The default map
directory is `/mnt/h/osrm`; override it when required:

```bash
sudo ./install.sh --data-dir /var/lib/rogueroute/osrm \
  --region new-zealand
```

The installer deliberately does not start an empty OSRM service. Download and
prepare a region first:

```bash
cd /opt/media-server/RogueRoute-GPX
./rogueroute osm download new-zealand
./rogueroute osm prepare new-zealand
./rogueroute start
```

On first start, the `secrets-init` service generates the manager token inside a
private Docker volume. It enables the internal switcher without exposing a key
to the browser or `.env`. Never expose manager port 9090 through Nginx Proxy
Manager or the host firewall.

Use `sudo usermod -aG docker USERNAME`, then log out and back in, if the normal
administrator account cannot access Docker.

## Environment

Edit `/opt/media-server/RogueRoute-GPX/.env`. Do not commit that file. The installation
generates a persistent Server Actions encryption key automatically.

## Updates

Every normal release update uses two commands:

```bash
cd /opt/media-server/RogueRoute-GPX && git pull --ff-only
./rogueroute update
```

The second command automatically applies the release number in `VERSION`; do
not manually edit `ROGUEROUTE_VERSION`.

The installer already fixes checkout and map-directory ownership. If a migrated
installation reports a write-permission error, run this once and then repeat
the normal update:

```bash
sudo ./rogueroute permissions
./rogueroute update
```

Normal Git, container and OSM commands should not use `sudo` after this repair.

The web interface uses port 9080. OSRM uses port 5000. Change `HOST_PORT` or
`OSRM_HOST_PORT` when those ports are already occupied.

## Uninstall

```bash
cd /opt/media-server/RogueRoute-GPX
./rogueroute stop
sudo mv /opt/media-server/RogueRoute-GPX /opt/media-server/RogueRoute-GPX-removed
```

Map data is external and is not removed automatically.
