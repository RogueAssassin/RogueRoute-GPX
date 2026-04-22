#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
ensure_node_version
ensure_env_file
ensure_media_net
enable_pnpm
load_env_values
check_port_free "${HOST_PORT:-}"
cd "$REPO_ROOT"
log "Pulling latest changes"
git pull
log "Installing dependencies"
pnpm install
log "Building workspace"
pnpm build
cd "$DOCKER_DIR"
log "Using env file: $ENV_FILE"
log "Starting RogueRoute GPX (Standard)"
docker compose up -d --build
log "Done. Check status with ./status.sh or docker compose ps"
