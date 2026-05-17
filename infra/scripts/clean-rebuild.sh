#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_header "RogueRoute GPX Clean Rebuild"
RUN_TYPE="$(get_workspace_run_type)"
print_workspace_run_type "$RUN_TYPE"
mode="$(resolve_requested_mode "${1:-osrm}")"
bootstrap_env_file "$mode"
load_env_values
ensure_core_tools
ensure_media_net

set_env_var NEXT_PUBLIC_BUILD_TIME "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
set_env_var NEXT_PUBLIC_APP_VERSION "$APP_VERSION"
load_env_values

log "Stopping current containers."
docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_OSRM_FILE" --env-file "$ENV_FILE" down --remove-orphans || true

clean_web_build_artifacts false
log "Building gpx-web with --no-cache so old Next.js action/client manifests cannot survive."
if [[ "$mode" == "osrm" ]]; then
  docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_OSRM_FILE" --env-file "$ENV_FILE" build --no-cache gpx-web
  docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_OSRM_FILE" --env-file "$ENV_FILE" up -d
else
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache gpx-web
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
fi

print_restart_help
log "Tip: click 'Reset browser cache' in the web UI once after a clean rebuild."
