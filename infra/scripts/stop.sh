#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
cd "$DOCKER_DIR"
log "Stopping RogueRoute GPX stack"
docker compose -f docker-compose.yml -f docker-compose.osrm.yml down || true
docker compose down || true
if [[ "${CLEAN_WEB_AFTER_STOP:-true}" == "true" ]]; then
  clean_web_build_artifacts false
fi
log "Stop complete"
