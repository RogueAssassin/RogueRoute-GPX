#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_header "RogueRoute GPX OSM Build Repair"
bootstrap_env_file osrm
load_env_values
mkdir -p "$OSRM_DATA_DIR/_build-logs"

ORIGINAL_THREADS="${OSRM_THREADS:-8}"
SAFE_THREADS="${OSRM_SAFE_THREADS:-2}"
LOG_FILE="$OSRM_DATA_DIR/_build-logs/repair-$(date +%Y%m%d-%H%M%S).log"

log "Writing repair log to: $LOG_FILE"
log "Pass 1: repair all missing/partial extracts using OSRM_THREADS=$ORIGINAL_THREADS"
set_env_var OSRM_THREADS "$ORIGINAL_THREADS"
if "$REPO_ROOT/prepare-osrm.sh" repair all --yes 2>&1 | tee "$LOG_FILE"; then
  log "All OSM/OSRM builds completed on the first pass."
  exit 0
fi

warn "Some builds failed. Starting a safer second pass with OSRM_THREADS=$SAFE_THREADS."
warn "This helps on memory-constrained hosts where large extracts fail during osrm-extract."
set_env_var OSRM_THREADS "$SAFE_THREADS"
if "$REPO_ROOT/prepare-osrm.sh" repair all --yes 2>&1 | tee -a "$LOG_FILE"; then
  set_env_var OSRM_THREADS "$ORIGINAL_THREADS"
  log "Second pass completed successfully."
  exit 0
fi

set_env_var OSRM_THREADS "$ORIGINAL_THREADS"
warn "Some files still failed after the safe-thread retry."
warn "Next steps: run './prepare-osrm.sh repair list' and rebuild one failed region with './prepare-osrm.sh repair <index> --force --yes'."
warn "If the same PBF fails repeatedly, delete only that '<file>.osm.pbf.part' if present, re-download that region, then run repair again."
exit 1
