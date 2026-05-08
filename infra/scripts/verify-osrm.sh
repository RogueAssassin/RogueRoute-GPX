#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
print_header "RogueRoute GPX v10 OSRM Verify"
bootstrap_env_file osrm
validate_env_for_mode osrm
verify_osrm_outputs
if command -v curl >/dev/null 2>&1; then
  if curl -fsS "http://127.0.0.1:${OSRM_HOST_PORT:-5000}/nearest/v1/foot/144.9631,-37.8136" >/dev/null 2>&1; then
    log "OSRM nearest endpoint is responding."
  else
    warn "OSRM nearest endpoint is not responding on 127.0.0.1:${OSRM_HOST_PORT:-5000}."
  fi
fi
