#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
enable_pnpm
ensure_env_file
load_env_values
prepare_valhalla_data
cd "$REPO_ROOT"
log "Stopping running stack"
"$REPO_ROOT/stop.sh" || true
log "Fetching latest changes"
git fetch origin
log "Resetting repo to origin/main"
git reset --hard origin/main
log "Cleaning stale files while preserving infra/docker/.env"
git clean -fdx -e infra/docker/.env -e infra/docker/.env.example
log "Installing dependencies"
pnpm install
log "Building workspace"
pnpm build
cd "$DOCKER_DIR"
log "Redeploying RogueRoute GPX with Valhalla"
docker compose -f docker-compose.yml -f docker-compose.valhalla.yml up -d --build
log "Refresh complete"
