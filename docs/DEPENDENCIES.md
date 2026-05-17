# Dependencies

RogueRoute-GPX pins its host build/runtime tooling so installs are reproducible.

## Supported pins

- Node.js `24.15.0` exactly for host-side builds
- Docker web image `node:24.15.0-alpine`
- pnpm `11.0.8`
- TypeScript `6.0.3`
- Docker Engine + Docker Compose plugin
- OSRM backend Docker image for OSRM mode

## One-command host dependency install

On Ubuntu/Debian or WSL2 Ubuntu, run:

```bash
bash fix-permissions.sh
./install-dependencies.sh --yes
```

The installer adds:

- base build tools: `build-essential`, `gcc`, `g++`, `make`, `libssl-dev`
- Git and download tools: `git`, `curl`, `wget`, `rsync`
- archive tools: `zip`, `unzip`, `xz-utils`, `p7zip-full`
- shell/admin tools: `jq`, `nano`, `vim`, `htop`, `tmux`, `screen`, `tree`
- network tools: `iproute2`, `iputils-ping`, `dnsutils`, `net-tools`
- Python helpers: `python3`, `python3-pip`, `python3-venv`
- Docker Engine, Buildx, and the Docker Compose plugin
- nvm, Node.js `24.15.0`, and pnpm `11.0.8`

It also creates the default OSRM data directory at `/mnt/h/osrm` and writes host tuning to `/etc/sysctl.d/99-rogueroute-gpx.conf`.

## Useful installer options

```bash
./install-dependencies.sh --help
./install-dependencies.sh --yes
./install-dependencies.sh --yes --osrm-dir /data/osrm
./install-dependencies.sh --yes --no-docker
./install-dependencies.sh --yes --no-osrm-dir
```

After Docker is installed, log out/in or run:

```bash
newgrp docker
```

## Manual fallback

If you cannot use the dependency installer, install Docker/Docker Compose through your OS package manager, then install Node with nvm:

```bash
nvm install 24.15.0
nvm use 24.15.0
nvm alias default 24.15.0
corepack enable
corepack prepare pnpm@11.0.8 --activate
```

`npm install` is not the supported workspace install method for this project. Use `pnpm install`.
