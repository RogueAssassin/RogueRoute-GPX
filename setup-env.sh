#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/infra/scripts/_common.sh"
MODE_INPUT=""
OSRM_DATA_DIR_INPUT=""

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    standard|std|direct|osrm|routing)
      [[ -z "$MODE_INPUT" ]] || fail "Only one mode may be supplied"
      MODE_INPUT="$1"
      shift
      ;;
    --data-dir)
      [[ -n "${2:-}" ]] || fail "--data-dir requires an absolute path"
      OSRM_DATA_DIR_INPUT="$2"
      shift 2
      ;;
    --data-dir=*)
      OSRM_DATA_DIR_INPUT="${1#--data-dir=}"
      shift
      ;;
    -h|--help|help)
      cat <<USAGE
Usage:
  ./setup-env.sh standard
  ./setup-env.sh osrm
  ./setup-env.sh osrm --data-dir /var/lib/rogueroute/osrm
USAGE
      exit 0
      ;;
    *) fail "Unknown setup-env option: $1. Use --help." ;;
  esac
done

MODE="$(resolve_requested_mode "${MODE_INPUT:-osrm}")"
print_header "RogueRoute GPX Env Setup"
bootstrap_env_file "$MODE"
configure_env_for_mode "$MODE"
if [[ -n "$OSRM_DATA_DIR_INPUT" ]]; then
  [[ "$OSRM_DATA_DIR_INPUT" = /* ]] || fail "--data-dir must be an absolute path: $OSRM_DATA_DIR_INPUT"
  set_env_var OSRM_DATA_DIR "$OSRM_DATA_DIR_INPUT"
fi
load_env_values
log "Created/updated: $ENV_FILE"
log "Mode: $MODE"
if [[ "$MODE" == "osrm" ]]; then
  log "OSRM_URL: $OSRM_URL"
  log "OSRM container name for logs/Dozzle: rogueroute-osrm"
  log "OSRM Compose service/DNS for app traffic: osrm"
  log "OSRM data directory: $OSRM_DATA_DIR"
  log "Edit $ENV_FILE and confirm OSRM_DATA_DIR, OSRM_PBF, and OSRM_GRAPH before first deploy."
fi
