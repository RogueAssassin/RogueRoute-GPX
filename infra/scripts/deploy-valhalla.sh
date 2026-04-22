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
check_port_free "8002"
prepare_valhalla_data
cd "$REPO_ROOT"
log "Pulling latest changes"
git pull
log "Installing dependencies"
pnpm install
log "Building workspace"
pnpm build
cd "$DOCKER_DIR"
log "Using env file: $ENV_FILE"
log "Starting RogueRoute GPX with Valhalla Enhanced"
log "Valhalla data path: ${VALHALLA_DATA_PATH:-unset}"
docker compose -f docker-compose.yml -f docker-compose.valhalla.yml up -d --build
log "Done. Check logs with ./logs-valhalla.sh"
