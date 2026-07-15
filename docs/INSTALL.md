# Installation

RogueRoute GPX v12.3.0 is installed as an independent Docker Compose project.
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

Clone and install RogueRoute:

```bash
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
sudo ./install.sh
```

The default installation directory is `/opt/rogueroute-gpx` and the default map
directory is `/mnt/h/osrm`. Override either location when required:

```bash
sudo ./install.sh --path /opt/rogueroute-gpx \
  --data-dir /var/lib/rogueroute/osrm \
  --region new-zealand
```

The installer deliberately does not start an empty OSRM service. Download and
prepare a region first:

```bash
cd /opt/rogueroute-gpx
./rogueroute osm download new-zealand
./rogueroute osm prepare new-zealand
./rogueroute start
```

Installation generates `OSRM_MANAGER_TOKEN`, enables the internal switcher and
starts the manager with no published host port. Never expose manager port 9090
through Nginx Proxy Manager or the host firewall.

Use `sudo usermod -aG docker USERNAME`, then log out and back in, if the normal
administrator account cannot access Docker.

## Environment

Edit `/opt/rogueroute-gpx/.env`. Do not commit that file. The installation
generates a persistent Server Actions encryption key automatically.

The web interface uses port 9080. OSRM uses port 5000. Change `HOST_PORT` or
`OSRM_HOST_PORT` when those ports are already occupied.

## Uninstall

```bash
cd /opt/rogueroute-gpx
./rogueroute stop
sudo mv /opt/rogueroute-gpx /opt/rogueroute-gpx-removed
```

Map data is external and is not removed automatically.
