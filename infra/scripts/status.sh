#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
cd "$DOCKER_DIR"
log "Docker compose services"
docker compose -f docker-compose.yml -f docker-compose.osrm.yml ps || docker compose ps || true
echo
log "Matching containers"
docker ps --format 'table {{.Names}}	{{.Image}}	{{.Status}}' | grep -Ei 'gpx|rogue|osrm' || true
