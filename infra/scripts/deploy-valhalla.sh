#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_header "RogueRoute GPX v8 Valhalla Deploy"
print_step 1 8 "Create env file if missing"
bootstrap_env_file valhalla

print_step 2 8 "Review env and check Docker and Node.js"
maybe_edit_env_file valhalla
ensure_core_tools
ensure_env_file
validate_env_for_mode valhalla
ensure_media_net

print_step 3 8 "Prepare pnpm"
enable_pnpm
load_env_values
check_port_free "${HOST_PORT:-}"
check_port_free "8002"

print_step 4 8 "Validate Valhalla data"
prepare_valhalla_data

print_step 5 8 "Update git checkout if available"
cd "$REPO_ROOT"
update_repo_if_git_checkout

print_step 6 8 "Install dependencies"
pnpm install

print_step 7 8 "Build workspace"
pnpm build

print_step 8 8 "Start Docker services"
cd "$DOCKER_DIR"
log "Using env file: $ENV_FILE"
log "Starting RogueRoute GPX with Valhalla Enhanced"
log "Valhalla data path: ${VALHALLA_DATA_PATH:-unset}"
docker compose -f docker-compose.yml -f docker-compose.valhalla.yml up -d --build
log "Done. Check logs with ./logs-valhalla.sh"
