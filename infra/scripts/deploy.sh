#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_header "RogueRoute GPX v8 Standard Deploy"
print_step 1 7 "Create env file if missing"
bootstrap_env_file standard

print_step 2 7 "Check Docker and Node.js"
ensure_core_tools
ensure_node_version
ensure_env_file
validate_env_for_mode standard
ensure_media_net

print_step 3 7 "Prepare pnpm"
enable_pnpm
load_env_values
check_port_free "${HOST_PORT:-}"

print_step 4 7 "Update git checkout if available"
cd "$REPO_ROOT"
update_repo_if_git_checkout

print_step 5 7 "Install dependencies"
pnpm install

print_step 6 7 "Build workspace"
pnpm build

print_step 7 7 "Start Docker services"
cd "$DOCKER_DIR"
log "Using env file: $ENV_FILE"
log "Starting RogueRoute GPX (Standard)"
docker compose up -d --build
log "Done. Check status with ./status.sh or docker compose ps"
