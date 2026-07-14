#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

require_docker
ensure_env
verify_graph
log "Pulling RogueRoute GPX v12 and OSRM container updates."
compose pull
compose up -d --remove-orphans
log "RogueRoute GPX is starting at http://SERVER-IP:$(get_env_value HOST_PORT 9080)"
compose ps
