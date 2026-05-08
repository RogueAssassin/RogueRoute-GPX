#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
source "$REPO_ROOT/scripts/osm-region-catalog.sh"

print_header "RogueRoute GPX v10 OSM Download"
bootstrap_env_file osrm
load_env_values
mkdir -p "$OSRM_DATA_DIR"
ensure_osm_region_env_catalog

usage() {
  cat <<USAGE
Usage:
  ./download-osm.sh list
  ./download-osm.sh <region-key>
  ./download-osm.sh popular
  ./download-osm.sh core
  ./download-osm.sh all
  ./download-osm.sh custom <url> <graph-base>

Examples:
  ./download-osm.sh australia
  ./download-osm.sh hawaii
  ./download-osm.sh popular

Data folder: $OSRM_DATA_DIR
USAGE
}

list_regions() {
  printf '%-28s %-34s %-14s %-16s %-8s\n' "KEY" "REGION" "PBF" "OSRM EXPANDED" "GROUP"
  echo "$OSM_REGION_CATALOG" | while IFS='|' read -r key label url graph rough expanded priority; do
    [[ -z "$key" ]] && continue
    printf '%-28s %-34s %-14s %-16s %-8s\n' "$key" "$label" "$rough" "$expanded" "$priority"
  done
}

find_region() { region_from_catalog "$1"; }

register_region_env() {
  local key="$1" graph="$2" pbf="$3"
  local region_var
  region_var="$(region_env_name "$key")"
  set_env_var "$region_var" "$pbf"
}

download_one() {
  local key="$1" line label url graph rough expanded priority pbf tmp
  line="$(find_region "$key")"
  [[ -n "$line" ]] || fail "Unknown OSM region: $key. Run ./download-osm.sh list"
  IFS='|' read -r key label url graph rough expanded priority <<< "$line"
  pbf="${graph}-latest.osm.pbf"
  tmp="$OSRM_DATA_DIR/${pbf}.part"
  log "Region: $label ($key)"
  log "URL: $url"
  log "Target: $OSRM_DATA_DIR/$pbf"
  log "Rough sizes: download $rough, expanded OSRM $expanded"
  if [[ -f "$OSRM_DATA_DIR/$pbf" ]]; then
    warn "Already exists: $OSRM_DATA_DIR/$pbf"
  else
    if command -v curl >/dev/null 2>&1; then
      curl -L --fail --continue-at - --output "$tmp" "$url"
    elif command -v wget >/dev/null 2>&1; then
      wget -c -O "$tmp" "$url"
    else
      fail "curl or wget is required"
    fi
    mv "$tmp" "$OSRM_DATA_DIR/$pbf"
  fi
  register_region_env "$key" "$graph" "$pbf"
  log "Registered in infra/docker/.env: $(region_env_name "$key")=$pbf"
  if [[ -z "${OSRM_ACTIVE_REGION:-}" || "${OSRM_ACTIVE_REGION:-australia}" == "planet" ]]; then
    set_env_var OSRM_ACTIVE_REGION "$key"
    set_env_var OSRM_PBF "$pbf"
    set_env_var OSRM_GRAPH "${graph}.osrm"
    log "Set active region to $key because no usable active region was configured."
  fi
  log "To build this region: ./prepare-osrm.sh region $key"
}

download_by_group() {
  local group="$1"
  echo "$OSM_REGION_CATALOG" | while IFS='|' read -r key label url graph rough expanded priority; do
    [[ -z "$key" ]] && continue
    [[ "$priority" == "$group" ]] && download_one "$key"
  done
}

cmd="${1:-list}"
case "$cmd" in
  list) list_regions ;;
  core) download_by_group core ;;
  popular)
    for key in australia new-zealand japan south-korea taiwan singapore-malaysia-brunei us hawaii canada mexico uk-ireland germany france spain italy netherlands; do download_one "$key"; done
    ;;
  all)
    warn "This downloads many large files. Europe/US/South America can be huge. Press Ctrl+C now to cancel."
    sleep 8
    echo "$OSM_REGION_CATALOG" | cut -d'|' -f1 | while read -r key; do [[ -n "$key" ]] && download_one "$key"; done
    ;;
  custom)
    url="${2:-}"; graph="${3:-custom}"; key="custom-${graph}"
    [[ "$url" =~ ^https?:// ]] || fail "Custom URL must start with http:// or https://"
    pbf="${graph}-latest.osm.pbf"
    log "Downloading custom extract: $url"
    curl -L --fail --continue-at - --output "$OSRM_DATA_DIR/${pbf}.part" "$url"
    mv "$OSRM_DATA_DIR/${pbf}.part" "$OSRM_DATA_DIR/$pbf"
    register_region_env "$key" "$graph" "$pbf"
    log "Downloaded and registered: $OSRM_DATA_DIR/$pbf"
    ;;
  -h|--help|help) usage ;;
  *) download_one "$cmd" ;;
esac
