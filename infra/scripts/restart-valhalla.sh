#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
ensure_env_file
ensure_media_net
load_env_values
check_port_free "${HOST_PORT:-}"
check_port_free "8002"
check_valhalla_data
verify_valhalla_outputs
cd "$DOCKER_DIR"
log "Restarting RogueRoute GPX with Valhalla Enhanced without pulling new code"
docker compose -f docker-compose.yml -f docker-compose.valhalla.yml up -d
print_restart_help
