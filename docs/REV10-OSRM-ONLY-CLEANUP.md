# Rev 10 OSRM-only cleanup

This package is OSRM-only. All Valhalla compose files, env templates, wrapper scripts, router code, and web health metadata have been removed.

## Correct script path pattern

Top-level scripts are thin wrappers. They resolve their own directory first, then execute the real script from `infra/scripts`:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/infra/scripts/<script>.sh" "$@"
```

Internal scripts source the shared helpers from their own directory:

```bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
```

This keeps paths correct whether the command is run from the repo root, systemd, cron, or another working directory.

## Stop/restart cleanup

`./stop.sh` stops Docker Compose first, then removes stale web build artifacts:

- `apps/gpx-web/.next`
- `apps/gpx-web/out`
- `apps/gpx-web/tsconfig.tsbuildinfo`

`./restart.sh` also stops the stack before cleanup, then rebuilds and starts the correct OSRM compose stack.

Manual cleanup is available with:

```bash
./clean-web.sh
```

That command refuses to run while `gpx-web` is still active.

## OSRM commands

```bash
./download-osm.sh list
./download-osm.sh australia
./prepare-osrm.sh region australia
./deploy.sh osrm
./status.sh
./logs.sh
./restart.sh osrm
./stop.sh
```

## Runtime pins

- Node.js host/runtime: `24.15.0`
- Docker base image: `node:24.15.0-alpine`
- pnpm via Corepack: `10.33.4`
- TypeScript: `^6.0.3`
