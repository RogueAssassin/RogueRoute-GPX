# RogueRoute GPX v8.0.0

RogueRoute GPX is a self-hosted GPX route generator with a web UI on port `9080`, IITC export support, and an optional Valhalla mode for land-aware routing.

## Documentation
Choose the guide that matches your setup and experience level:

### Start here
- [Standard Mode Beginner Guide](docs/GUIDE-STANDARD-BEGINNER.md)
- [Valhalla Mode Intermediate Guide](docs/GUIDE-VALHALLA-INTERMEDIATE.md)
- [System Requirements](docs/SYSTEM-REQUIREMENTS.md)

### Setup and operations
- [Installation Overview](docs/INSTALLATION.md)
- [Docker Deployment and Recovery](docs/DOCKER-DEPLOYMENT.md)
- [Commands Reference](docs/COMMANDS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

### Extra guides
- [Dependencies Standard](docs/DEPENDENCIES.md)
- [Valhalla Setup Notes](docs/VALHALLA-SETUP.md)
- [IITC Setup](docs/IITC-SETUP.md)
- [systemd Service Guide](docs/SYSTEMD-SERVICE.md)
- [GitHub Desktop Release Guide](docs/GITHUB-DESKTOP.md)

## Supported software standard
RogueRoute GPX v8.0.0 uses this official support baseline:

- **Node.js:** 24.15.0 (Krypton)
- **Package manager:** pnpm 10.33.1
- **Package manager activation:** Corepack 0.34.7
- **Containers:** Docker Engine / CLI 29.4.1 with `docker compose`
- **Git:** required only for clone-based installs and Git-based updates

`npm install` is **not** the supported workspace install method for this project. Use Corepack and pnpm.

The repo also includes `.nvmrc`, `.node-version`, and `.npmrc` guardrails to keep contributors on the official toolchain.

## Choose your mode

### Standard mode
Best for first-time self-hosting and the cleanest beginner path.

You get:
- the RogueRoute GPX web app
- lower storage and RAM usage
- the easiest deploy and restart workflow
- no external routing dataset to manage

### Valhalla mode
Best for users who want more realistic land-aware road and path routing.

You get:
- land-aware routing through Valhalla
- support for external `.osm.pbf` files or existing tiles
- repair and verification workflows
- higher CPU, RAM, and storage requirements

## Environment templates
This release includes separate environment templates:

- `infra/docker/.env.standard`
- `infra/docker/.env.valhalla`

On first run, `bash first-run.sh` creates `infra/docker/.env` from the selected template.

## Quick commands
Run these from the repo root:

```bash
bash fix-permissions.sh
bash first-run.sh
./deploy.sh
./deploy-valhalla.sh
./restart.sh
./restart-valhalla.sh
./verify-valhalla.sh
./doctor.sh
./status.sh
./logs.sh
./logs-valhalla.sh
./stop.sh
```

## Lockfile policy
Commit `pnpm-lock.yaml` for every official release.

To generate it on your supported machine:

```bash
corepack enable
corepack prepare pnpm@10.33.1 --activate
pnpm install
git add pnpm-lock.yaml
```

A helper script is included at `scripts/generate-lockfile.sh`.

## Release notes
- v8.0.0 aligns all app, IITC, health endpoint, and UI version strings.
- v8.0.0 promotes the split beginner/intermediate guide system into the main README.
- v8.0.0 standardizes the documented support baseline around Node 24.15.0, pnpm 10.33.1, Corepack 0.34.7, and Docker 29.4.1.
