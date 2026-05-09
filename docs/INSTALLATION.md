# Installation

RogueRoute-GPX has two supported install paths.

## Standard mode: easiest test install

Use this when you only want to test the web app and direct/fallback GPX generation.

```bash
git clone https://github.com/YOUR-USER/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
./setup-env.sh standard
./first-run.sh standard
./deploy.sh standard
```

## OSRM mode: recommended real install

Use this when you want routes that follow OpenStreetMap roads, paths, sidewalks, and footways.

```bash
git clone https://github.com/YOUR-USER/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
./setup-env.sh osrm
./first-run.sh osrm
./download-osm.sh list
./download-osm.sh australia
./prepare-osrm.sh region australia
./deploy.sh osrm
```

Open the app at:

```text
http://SERVER-IP:9080
```

## Environment files

You can create/update `infra/docker/.env` explicitly before booting:

```bash
./setup-env.sh osrm      # recommended real install
./setup-env.sh standard  # fallback/direct mode only
```

The first run also creates `infra/docker/.env` from one of these templates when it is missing:

- `infra/docker/.env.standard`
- `infra/docker/.env.osrm`

`infra/docker/.env` is machine-specific and must not be committed to GitHub. In OSRM mode, keep `OSRM_URL=http://osrm:5000`; `osrm` is the Docker Compose service/DNS name. The container name remains `rogueroute-osrm` for logs and Dozzle.

## Supported versions

- Node.js `24.15.0`
- pnpm `11.0.8`
- TypeScript `6.0.3`
- Docker Engine / CLI with `docker compose`

For more detail, read `docs/SYSTEM-REQUIREMENTS.md`.

## Runtime-only server updates

Deployment servers do not need local docs, README files, or release notes. Fresh servers can use Git sparse checkout, and `./update.sh` refreshes only runtime paths by default when the repo is a git checkout. Use `ROGUEROUTE_FULL_CHECKOUT=true ./update.sh` only if you want the full documentation tree locally.
