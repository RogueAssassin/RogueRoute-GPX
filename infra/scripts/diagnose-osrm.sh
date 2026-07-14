#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
print_header "RogueRoute GPX v12 OSRM Diagnose"
bootstrap_env_file osrm
load_env_values
ensure_core_tools
ensure_media_net
verify_osrm_outputs || true
verify_osrm_runtime_graph || true
print_osrm_restart_loop_help
cd "$DOCKER_DIR"
docker compose -f docker-compose.yml -f docker-compose.osrm.yml --env-file "$ENV_FILE" ps || true
docker compose -f docker-compose.yml -f docker-compose.osrm.yml --env-file "$ENV_FILE" logs --tail=120 osrm || true
