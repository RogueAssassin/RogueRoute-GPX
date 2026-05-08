#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
ensure_env_file
ensure_media_net
MODE="$(resolve_requested_mode "${1:-}")"
validate_env_for_mode "$MODE"
load_env_values
check_port_free "${HOST_PORT:-}"
log "Restarting RogueRoute GPX ($MODE) without pulling new code"
cd "$DOCKER_DIR"
if [[ "$MODE" == "osrm" ]]; then
  docker compose -f docker-compose.yml -f docker-compose.osrm.yml down || true
  clean_web_build_artifacts false
  docker compose -f docker-compose.yml -f docker-compose.osrm.yml up -d --build
else
  docker compose down || true
  clean_web_build_artifacts false
  docker compose up -d --build
fi
print_restart_help
