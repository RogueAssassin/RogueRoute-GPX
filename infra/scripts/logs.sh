#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
cd "$DOCKER_DIR"
if docker ps --format '{{.Names}}' | grep -q '^rogueroute-osrm$'; then
  docker compose -f docker-compose.yml -f docker-compose.osrm.yml logs -f gpx-web osrm
else
  docker compose logs -f gpx-web
fi
