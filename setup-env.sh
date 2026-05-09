#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/infra/scripts/_common.sh"
MODE="$(resolve_requested_mode "${1:-osrm}")"
print_header "RogueRoute GPX Env Setup"
bootstrap_env_file "$MODE"
configure_env_for_mode "$MODE"
load_env_values
log "Created/updated: $ENV_FILE"
log "Mode: $MODE"
if [[ "$MODE" == "osrm" ]]; then
  log "OSRM_URL: $OSRM_URL"
  log "OSRM container name for logs/Dozzle: rogueroute-osrm"
  log "OSRM Compose service/DNS for app traffic: osrm"
  log "Edit $ENV_FILE and confirm OSRM_DATA_DIR, OSRM_PBF, and OSRM_GRAPH before first deploy."
fi
