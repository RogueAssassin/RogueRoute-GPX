#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
MODE="$(resolve_requested_mode "${1:-}")"
print_header "RogueRoute GPX v12 Deploy"
print_step 1 8 "Create env file if missing"
bootstrap_env_file "$MODE"
configure_env_for_mode "$MODE"
maybe_edit_env_file "$MODE"
print_step 2 8 "Update git checkout if available"
cd "$REPO_ROOT"
update_repo_if_git_checkout
source "$SCRIPT_DIR/_common.sh"
print_step 3 8 "Check Docker and Node.js"
ensure_core_tools
ensure_node_version
ensure_env_file
validate_env_for_mode "$MODE"
ensure_media_net
print_step 4 8 "Prepare pnpm"
enable_pnpm
load_env_values
check_port_free "${HOST_PORT:-}"
print_step 5 8 "Install/repair dependencies"
repair_workspace_dependencies
print_step 6 8 "Build workspace"
build_workspace
print_step 7 8 "Check routing data"
if [[ "$MODE" == "osrm" ]]; then
  verify_osrm_outputs
  verify_osrm_runtime_graph || warn "OSRM graph check failed. The web app can still start, but osrm may stop after limited retries."
fi
print_step 8 8 "Start Docker services"
cd "$DOCKER_DIR"
log "Using env file: $ENV_FILE"
if [[ "$MODE" == "osrm" ]]; then
  log "Starting RogueRoute-GPX with OSRM"
  docker compose -f docker-compose.yml -f docker-compose.osrm.yml up -d --build
else
  log "Starting RogueRoute-GPX in direct fallback mode"
  docker compose up -d --build
fi
log "Done. Check status with ./status.sh or docker compose ps"
