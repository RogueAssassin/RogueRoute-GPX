# Release audit notes for v10.13.0 public GitHub package

## Fixed in this cleaned package

- Removed committed `infra/docker/.env` so public users generate their own machine-specific environment file.
- Added missing `infra/docker/.env.osrm`, which `first-run.sh` and `_common.sh` already expected.
- Added `.gitignore` so env files, OSM downloads, OSRM graphs, backups, logs, and archives stay out of GitHub.
- Consolidated scattered `docs/REV10*` files into `docs/REV10-HISTORY.md`.
- Removed outdated `docs/V5-FEATURES.md` from the public docs set.
- Added `docs/GUIDE-OSRM-INTERMEDIATE.md` for average coders setting up the real OSRM workflow.
- Rewrote `README.md`, `docs/INSTALLATION.md`, `docs/COMMANDS.md`, `docs/GITHUB-DESKTOP.md`, and `docs/TROUBLESHOOTING.md` for clearer public deployment.
- Set shell scripts executable in the cleaned zip.

## Validation performed

```bash
bash -n infra/scripts/*.sh *.sh scripts/*.sh
```

Result: shell syntax passed.

## Not validated in this container

- Full `pnpm install` / `pnpm build` was not run because this container does not have pnpm installed and has Node.js `v22.16.0`, while the repo is pinned to Node.js `24.15.0` and pnpm `11.0.8`.
- Docker/OSRM runtime was not started because the container environment does not provide the project host mounts or Docker daemon needed for a real OSRM run.

## Recommended final local checks before GitHub release

```bash
nvm install 24.15.0
nvm use 24.15.0
corepack enable
corepack prepare pnpm@11.0.8 --activate
pnpm install --frozen-lockfile
pnpm build
bash -n infra/scripts/*.sh *.sh scripts/*.sh
git status --short
```

Confirm `git status` does not show any `.env`, `.osm.pbf`, `.osrm*`, `.zip`, or `_osrm-backups/` files.
