#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
ensure_env_file
ensure_media_net
load_env_values
check_port_free "${HOST_PORT:-}"
cd "$DOCKER_DIR"
log "Restarting RogueRoute GPX (Standard) without pulling new code"
docker compose up -d
print_restart_help
