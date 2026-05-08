#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
source "$REPO_ROOT/scripts/osm-region-catalog.sh"

print_header "RogueRoute GPX v10 OSRM Switch"
bootstrap_env_file osrm
load_env_values

REGION="${1:-}"
[[ -n "$REGION" ]] || fail "Usage: ./switch-osrm-region.sh <region-key>"

# Accept both catalog keys and common graph/PBF-style names from the web UI or shell.
REGION="${REGION%.osm.pbf}"
REGION="${REGION%.osrm}"
REGION="${REGION%-latest}"

line="$(region_from_catalog "$REGION")"
[[ -n "$line" ]] || fail "Unknown region: $REGION. Run ./download-osm.sh list"
IFS='|' read -r key label url graph rough expanded priority <<< "$line"
PBF="${graph}-latest.osm.pbf"
GRAPH="${PBF%.osm.pbf}.osrm"
BASE="${GRAPH%.osrm}"

if [[ ! -d "$OSRM_DATA_DIR" ]]; then
  fail "OSRM_DATA_DIR is not visible here: $OSRM_DATA_DIR. If switching from the web UI, mount OSRM_DATA_DIR into gpx-web in infra/docker/docker-compose.yml."
fi
[[ -f "$OSRM_DATA_DIR/$PBF" ]] || fail "Missing PBF for $label: $OSRM_DATA_DIR/$PBF. Run: ./download-osm.sh $REGION"
count=$(find "$OSRM_DATA_DIR" -maxdepth 1 -name "${BASE}.osrm*" | wc -l | tr -d ' ')
[[ "$count" != "0" ]] || fail "Missing prepared OSRM graph for $label: ${BASE}.osrm*. Run: ./prepare-osrm.sh region $REGION"
command -v docker >/dev/null 2>&1 || fail "docker CLI is not available. Rebuild gpx-web so the runner includes docker-cli and docker-cli-compose."
docker compose version >/dev/null 2>&1 || fail "docker compose is not available inside this runtime."

set_env_var OSRM_ACTIVE_REGION "$REGION"
set_env_var OSRM_PBF "$PBF"
set_env_var OSRM_GRAPH "$GRAPH"
set_env_var "$(region_env_name "$REGION")" "$PBF"

log "Active region: $label ($REGION)"
log "PBF: $PBF"
log "Graph: $GRAPH"
ensure_media_net
cd "$DOCKER_DIR"
docker compose -f docker-compose.yml -f docker-compose.osrm.yml up -d --force-recreate osrm
log "Waiting for OSRM health..."
for i in $(seq 1 60); do
  state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' rogueroute-osrm 2>/dev/null || true)"
  if [[ "$state" == "healthy" || "$state" == "running" ]]; then
    log "OSRM region ready: $REGION"
    exit 0
  fi
  sleep 2
done
warn "OSRM restarted but health did not become ready within the wait window. Check: ./logs.sh osrm"
