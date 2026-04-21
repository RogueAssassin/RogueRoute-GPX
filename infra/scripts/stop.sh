#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
cd "$DOCKER_DIR"
log "Stopping RogueRoute GPX stack"
docker compose -f docker-compose.yml -f docker-compose.valhalla.yml down || true
docker compose down || true
log "Stop complete"
