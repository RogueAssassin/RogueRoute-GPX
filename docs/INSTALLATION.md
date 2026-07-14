# Installation

This guide covers a clean Ubuntu or Debian server with no existing Node.js,
pnpm, Docker, or RogueRoute installation. OSRM mode is recommended when GPX
routes must follow OpenStreetMap roads, footways, and walking tracks.

## Recommended v12 production install

For a server that already has prepared OSRM graphs, use the standalone v12
Docker package. It pulls the prebuilt GHCR image and requires only Docker,
Compose, Bash, and OpenSSL on the host; Node.js and pnpm are development tools.

```bash
unzip RogueRoute-GPX-v12-standalone-docker.zip -d /tmp
cd /tmp/RogueRoute-GPX
sudo ./install.sh --target /opt/media-server/RogueRoute-GPX
```

This deployment has its own Docker network and is not part of Rogue Dashboard
or the media-server Compose project. See `standalone/README.md` for migration,
private-package login, daily commands, and rollback details.

The remaining instructions build from source and include the tools needed to
download and prepare new OSM extracts.

## Before you start

You need:

- a normal user with `sudo` access (do not install or run the app as root)
- internet access for GitHub, Docker packages/images, npm packages, and OSM extracts
- TCP port `9080` available for the web app
- at least 10 GB free disk for Standard mode
- additional RAM and disk for OSRM; requirements vary greatly by region

Download only the regions you actually route in. Country and sub-region
extracts are far easier to prepare than continental or planet files.

## Vanilla Linux: OSRM install

### 1. Install the small bootstrap set

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
```

### 2. Clone RogueRoute

```bash
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
```

### 3. Install the host dependencies

For a normal Linux server, `/var/lib/rogueroute/osrm` is a clear map-data
location:

```bash
./install-dependencies.sh --yes --osrm-dir /var/lib/rogueroute/osrm
```

This installs Docker Engine and Compose, nvm, the pinned Node.js/pnpm versions,
build tools, and `osmium-tool` for validating downloads. It does not perform a
full operating-system upgrade unless `--upgrade-system` is supplied.

If the installer added you to the Docker group, activate that membership:

```bash
newgrp docker
docker info
```

Logging out and back in does the same thing. Do not use `sudo ./deploy.sh` as a
workaround; that creates root-owned project files.

### 4. Create the OSRM configuration

```bash
./setup-env.sh osrm --data-dir /var/lib/rogueroute/osrm
./first-run.sh osrm
```

The machine-specific configuration is stored in `infra/docker/.env` and is not
committed to Git. Existing `.env` values and downloaded map data are preserved
on updates.

### 5. Download one OpenStreetMap extract

```bash
./download-osm.sh list
./download-osm.sh new-zealand
```

Use `australia`, `japan`, or another key shown by `list` when appropriate.
Downloads resume from `.part` files, retry transient failures, and are validated
before becoming the final `.osm.pbf`.

### 6. Prepare that region for OSRM

```bash
./prepare-osrm.sh region new-zealand
```

This runs extract, partition, and customise in sequence. If the normal build
fails, RogueRoute preserves the partial output, retries once with the safer
thread setting, and writes a log under `OSRM_DATA_DIR/_build-logs`.

### 7. Start the application

```bash
./deploy.sh osrm
./status.sh
./doctor.sh
```

Open `http://SERVER-IP:9080`. If UFW is active and the app is for other devices
on your network, allow the port with `sudo ufw allow 9080/tcp`.

## Standard/direct install

Standard mode is useful for a lightweight test but does not follow OSM paths.

```bash
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
./install-dependencies.sh --yes --no-osrm-dir
newgrp docker
./setup-env.sh standard
./first-run.sh standard
./deploy.sh standard
```

## Download and prepare several regions

Batch downloads continue after an individual region fails and finish with a
summary of every failed key:

```bash
./download-osm.sh popular
./download-osm.sh list
```

Prepare every valid PBF already present in the data folder:

```bash
./prepare-osrm.sh all-downloaded --yes
./prepare-osrm.sh repair list
```

Ready graphs are skipped. Partial graphs are moved into `_osrm-backups` and
rebuilt; downloaded `.osm.pbf` inputs are never deleted.

## Updating an existing server

```bash
git pull --ff-only
./update.sh osrm
./doctor.sh
```

Pull first when upgrading from an older release so the updater loads the new
Node.js and pnpm requirements before installing dependencies.

For commands and recovery steps, see [COMMANDS.md](COMMANDS.md) and
[TROUBLESHOOTING.md](TROUBLESHOOTING.md).
