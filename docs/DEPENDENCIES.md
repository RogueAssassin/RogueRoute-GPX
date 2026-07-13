# Dependencies

RogueRoute-GPX pins its host build/runtime tooling so installs are reproducible.

## Supported pins

- Node.js `24.18.0` exactly for host-side builds
- Docker web image `node:24.18.0-alpine`
- pnpm `11.12.0`
- TypeScript `6.0.3`
- Docker Engine + Docker Compose plugin
- OSRM backend Docker image for OSRM mode
- Leaflet `1.9.4` and React Leaflet `5.0.0` for the browser map preview

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
- OSM validation: `osmium-tool`
- Docker Engine, Buildx, and the Docker Compose plugin
- nvm, Node.js `24.18.0`, and pnpm `11.12.0`

It also creates the default OSRM data directory at `/mnt/h/osrm` and writes host tuning to `/etc/sysctl.d/99-rogueroute-gpx.conf`.

## Useful installer options

```bash
./install-dependencies.sh --help
./install-dependencies.sh --yes
./install-dependencies.sh --yes --osrm-dir /data/osrm
./install-dependencies.sh --yes --upgrade-system
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
nvm install 24.18.0
nvm use 24.18.0
nvm alias default 24.18.0
corepack enable
corepack prepare pnpm@11.12.0 --activate
```

`npm install` is not the supported workspace install method for this project. Use `pnpm install`.

TypeScript 7.0.2 was tested with this release but is intentionally deferred:
Next.js 16.2.10 currently fails its build-time TypeScript detection in this
workspace when TypeScript 7 is installed. TypeScript 6.0.3 remains the validated
production choice.

The workspace also intentionally stays on `@types/node` 24.x. The newer 26.x
types target a different Node.js major and are not an appropriate upgrade while
the production runtime is Node.js 24.
