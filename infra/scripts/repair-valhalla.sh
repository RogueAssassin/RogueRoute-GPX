#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
ensure_env_file
load_env_values
check_valhalla_data
print_valhalla_plan
log "Stopping Valhalla container if it is running"
cd "$DOCKER_DIR"
docker compose -f docker-compose.yml -f docker-compose.valhalla.yml stop valhalla || true
docker rm -f valhalla 2>/dev/null || true
cd "$REPO_ROOT"
remove_generated_valhalla_outputs
log "Valhalla source files preserved. Use ./verify-valhalla.sh, then ./deploy-valhalla.sh when you are ready to rebuild."
