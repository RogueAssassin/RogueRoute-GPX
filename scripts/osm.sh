#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/osm-region-catalog.sh"
ENV="$ROOT/.env"
[[ -f "$ENV" ]] || { echo "Missing $ENV" >&2; exit 1; }

get_env() { local v; v="$(grep -E "^$1=" "$ENV" | tail -n1 | cut -d= -f2- || true)"; printf '%s\n' "${v:-${2:-}}"; }
set_env() { if grep -qE "^$1=" "$ENV"; then sed -i "s|^$1=.*|$1=$2|" "$ENV"; else printf '%s=%s\n' "$1" "$2" >> "$ENV"; fi; }
fail() { echo "[ERROR] $*" >&2; exit 1; }
DATA="$(get_env OSRM_DATA_DIR /mnt/h/osrm)"
IMAGE="$(get_env OSRM_IMAGE osrm/osrm-backend:latest)"
mkdir -p "$DATA"

ensure_data_writable() {
  [[ -w "$DATA" && -w "$ENV" ]] ||
    fail "Map data or .env is not writable by $(id -un). Run once: sudo ./rogueroute permissions"
}

resolve() {
  local line
  line="$(region_from_catalog "$1")"
  [[ -n "$line" ]] || fail "Unknown region '$1'. Run: ./rogueroute osm list"
  IFS='|' read -r KEY LABEL URL GRAPH DOWNLOAD EXPANDED PRIORITY <<< "$line"
  PBF="${GRAPH}-latest.osm.pbf"
  OSRM="${GRAPH}-latest.osrm"
}

is_prepared() {
  local osrm="$1"
  [[ -s "$DATA/$osrm.mldgr" && -s "$DATA/$osrm.partition" && -s "$DATA/$osrm.cell_metrics" ]]
}

confirm_batch() {
  local action="$1" count="$2" assume_yes="$3" answer
  [[ "$assume_yes" == true ]] && return 0
  if [[ -t 0 ]]; then
    read -r -p "$action $count region(s)? This may use substantial disk space and time. [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || fail "Cancelled."
  else
    fail "Confirmation required. Review 'osm status', then repeat with --yes."
  fi
}

download_regions() {
  local region size expected actual stamp
  local -a failed=() skipped=()
  for region in "$@"; do
    resolve "$region"
    if [[ -s "$DATA/$PBF" ]]; then
      echo "[SKIP] $LABEL is already downloaded: $DATA/$PBF"
      skipped+=("$region")
      continue
    fi
    echo "[INFO] Downloading $LABEL to $DATA/$PBF"
    if curl --fail --location --retry 5 --retry-delay 3 --retry-all-errors \
      --continue-at - --output "$DATA/$PBF.part" "$URL"; then
      size="$(stat -c %s "$DATA/$PBF.part")"
      if (( size < 1048576 )); then
        echo "[ERROR] Download is unexpectedly small ($size bytes): $region" >&2
        failed+=("$region")
        continue
      fi
      if command -v md5sum >/dev/null && curl --fail --location --silent --show-error \
        --output "$DATA/$PBF.md5" "$URL.md5"; then
        expected="$(awk '{print $1; exit}' "$DATA/$PBF.md5")"
        actual="$(md5sum "$DATA/$PBF.part" | awk '{print $1}')"
        if [[ -z "$expected" || "$actual" != "$expected" ]]; then
          stamp="$(date +%Y%m%d-%H%M%S)"
          mv "$DATA/$PBF.part" "$DATA/$PBF.part.invalid-$stamp"
          echo "[ERROR] Checksum failed for $region; invalid file preserved and the next retry will start cleanly." >&2
          failed+=("$region")
          continue
        fi
      else
        echo "[WARN] Geofabrik checksum was unavailable; accepting the size-checked download."
      fi
      mv "$DATA/$PBF.part" "$DATA/$PBF"
      rm -f "$DATA/$PBF.md5"
      echo "[OK] $DATA/$PBF"
    else
      echo "[ERROR] Download failed for $region; .part retained for resume." >&2
      failed+=("$region")
    fi
  done
  echo "[INFO] Download batch complete. Requested: $#. Skipped: ${#skipped[@]}. Failed: ${#failed[@]}."
  (( ${#failed[@]} == 0 )) || fail "Failed region(s): ${failed[*]}. Run the same command to resume."
}

prepare_region() {
  local region="$1" suffix
  resolve "$region"
  [[ -r "$DATA/$PBF" ]] || return 2
  if is_prepared "$OSRM"; then
    echo "[SKIP] $LABEL is already prepared."
    return 3
  fi
  echo "[INFO] Preparing $LABEL with $IMAGE"
  docker run --rm -t -v "$DATA:/data" "$IMAGE" osrm-extract -p /opt/foot.lua "/data/$PBF" &&
    docker run --rm -t -v "$DATA:/data" "$IMAGE" osrm-partition "/data/$OSRM" &&
    docker run --rm -t -v "$DATA:/data" "$IMAGE" osrm-customize "/data/$OSRM" || return 1
  for suffix in mldgr partition cell_metrics; do
    [[ -s "$DATA/$OSRM.$suffix" ]] || return 1
  done
  echo "[OK] Prepared $region ($OSRM)"
}

command="${1:-list}"; shift || true
case "$command" in
  help|-h|--help)
    cat <<HELP
RogueRoute OSM/OSRM management

Configured data directory: $DATA

  ./rogueroute osm list
      List supported region keys, estimated download and expanded sizes.

  ./rogueroute osm status
      Show whether each region is missing, downloaded, partial or prepared.

  ./rogueroute osm download REGION [REGION...]
      Download one or more Geofabrik extracts. Interrupted .part files resume.
      Successful downloads are checksum-checked when Geofabrik supplies MD5.

  ./rogueroute osm download-missing [--yes]
      Download or resume every catalog region without a completed PBF. Existing
      downloads are skipped. --yes allows unattended operation.

  ./rogueroute osm prepare REGION
      Run osrm-extract with the foot profile, osrm-partition and osrm-customize
      inside $IMAGE. Outputs are written directly to $DATA.

  ./rogueroute osm prepare-downloaded [--yes]
      Prepare every downloaded region that does not have a complete MLD graph.

  ./rogueroute osm verify REGION
      Confirm the PBF and required .mldgr, .partition and .cell_metrics files.

  ./rogueroute osm switch REGION
      Select an already prepared graph in .env and recreate only OSRM.

  ./rogueroute osm path
      Print the configured OSRM_DATA_DIR.
HELP
    ;;
  list)
    printf '%-30s %-34s %-12s %s\n' REGION NAME DOWNLOAD EXPANDED
    while IFS='|' read -r key label _ _ download expanded _; do
      printf '%-30s %-34s %-12s %s\n' "$key" "$label" "$download" "$expanded"
    done <<< "$OSM_REGION_CATALOG" ;;
  path) printf '%s\n' "$DATA" ;;
  status)
    printf '%-30s %-12s %s\n' REGION STATE FILE
    while IFS='|' read -r key _ _ graph _ _ _; do
      pbf="${graph}-latest.osm.pbf"; osrm="${graph}-latest.osrm"
      if is_prepared "$osrm"; then state=prepared
      elif [[ -s "$DATA/$pbf" ]]; then state=downloaded
      elif [[ -s "$DATA/$pbf.part" ]]; then state=partial
      else state=missing; fi
      printf '%-30s %-12s %s\n' "$key" "$state" "$pbf"
    done <<< "$OSM_REGION_CATALOG" ;;
  download)
    ensure_data_writable
    (( $# > 0 )) || fail "Usage: ./rogueroute osm download REGION [REGION...]"
    download_regions "$@" ;;
  download-missing)
    ensure_data_writable
    assume_yes=false
    [[ "${1:-}" != "--yes" ]] || { assume_yes=true; shift; }
    (( $# == 0 )) || fail "Usage: ./rogueroute osm download-missing [--yes]"
    missing=()
    while IFS='|' read -r key _ _ graph _ _ _; do
      [[ -s "$DATA/${graph}-latest.osm.pbf" ]] || missing+=("$key")
    done <<< "$OSM_REGION_CATALOG"
    if (( ${#missing[@]} == 0 )); then echo "[OK] Every catalog region is already downloaded."; exit 0; fi
    echo "[INFO] Missing/partial regions (${#missing[@]}): ${missing[*]}"
    confirm_batch "Download" "${#missing[@]}" "$assume_yes"
    download_regions "${missing[@]}" ;;
  prepare)
    ensure_data_writable
    region="${1:-}"; [[ -n "$region" ]] || fail "Usage: ./rogueroute osm prepare REGION"
    prepare_region "$region" || rc=$?
    rc="${rc:-0}"
    (( rc == 2 )) && fail "Region is not downloaded. Run: ./rogueroute osm download $region"
    (( rc == 1 )) && fail "Preparation failed for $region; source PBF was preserved."
    resolve "$region"
    set_env OSRM_ACTIVE_REGION "$region"
    set_env OSRM_GRAPH "$OSRM"
    echo "[OK] Prepared and selected $region ($OSRM)" ;;
  prepare-downloaded)
    ensure_data_writable
    assume_yes=false
    [[ "${1:-}" != "--yes" ]] || { assume_yes=true; shift; }
    (( $# == 0 )) || fail "Usage: ./rogueroute osm prepare-downloaded [--yes]"
    pending=()
    while IFS='|' read -r key _ _ graph _ _ _; do
      [[ -s "$DATA/${graph}-latest.osm.pbf" ]] || continue
      is_prepared "${graph}-latest.osrm" || pending+=("$key")
    done <<< "$OSM_REGION_CATALOG"
    if (( ${#pending[@]} == 0 )); then echo "[OK] Every downloaded catalog region is prepared."; exit 0; fi
    echo "[INFO] Downloaded regions awaiting preparation (${#pending[@]}): ${pending[*]}"
    confirm_batch "Prepare" "${#pending[@]}" "$assume_yes"
    failed=()
    for region in "${pending[@]}"; do prepare_region "$region" || failed+=("$region"); done
    echo "[INFO] Preparation batch complete. Requested: ${#pending[@]}. Failed: ${#failed[@]}."
    (( ${#failed[@]} == 0 )) || fail "Failed region(s): ${failed[*]}. Completed graphs were retained." ;;
  verify)
    region="${1:-}"; [[ -n "$region" ]] || fail "Usage: ./rogueroute osm verify REGION"
    resolve "$region"
    missing=()
    [[ -s "$DATA/$PBF" ]] || missing+=("$PBF")
    for suffix in mldgr partition cell_metrics; do [[ -s "$DATA/$OSRM.$suffix" ]] || missing+=("$OSRM.$suffix"); done
    (( ${#missing[@]} == 0 )) || fail "Region $region is incomplete. Missing: ${missing[*]}"
    echo "[OK] $region is downloaded and prepared in $DATA" ;;
  switch)
    ensure_data_writable
    region="${1:-}"; [[ -n "$region" ]] || fail "Usage: ./rogueroute osm switch REGION"
    resolve "$region"
    [[ -s "$DATA/$OSRM.mldgr" ]] || fail "Region is not prepared: $DATA/$OSRM.mldgr"
    set_env OSRM_ACTIVE_REGION "$region"
    set_env OSRM_GRAPH "$OSRM"
    docker compose --env-file "$ENV" -f "$ROOT/compose.yaml" up -d --force-recreate osrm
    echo "[OK] Active OSRM region: $region ($OSRM)" ;;
  *) fail "Usage: ./rogueroute osm {list|status|path|download|download-missing|prepare|prepare-downloaded|verify|switch|help}" ;;
esac
