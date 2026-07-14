#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

region="${1:-}"
[[ -n "$region" ]] || fail "Usage: ./switch-region.sh <region-key>"

case "$region" in
  uk-ireland) base="britain-and-ireland" ;;
  singapore-malaysia-brunei) base="malaysia-singapore-brunei" ;;
  *) base="${region%-latest}" ;;
esac
base="${base%.osm.pbf}"
base="${base%.osrm}"

require_docker
ensure_env
data_dir="$(get_env_value OSRM_DATA_DIR /mnt/h/osrm)"
pbf="${base}-latest.osm.pbf"
graph="${base}-latest.osrm"

[[ -f "$data_dir/$pbf" ]] || fail "Downloaded PBF is missing: $data_dir/$pbf"
[[ -f "$data_dir/$graph.mldgr" ]] || fail "Prepared OSRM graph is missing: $data_dir/$graph.mldgr"

set_env_value OSRM_ACTIVE_REGION "$region"
set_env_value OSRM_PBF "$pbf"
set_env_value OSRM_GRAPH "$graph"
log "Switching the standalone stack to $region ($graph)."
compose up -d --force-recreate osrm gpx-web
compose ps
