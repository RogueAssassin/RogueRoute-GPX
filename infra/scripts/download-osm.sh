#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
source "$REPO_ROOT/scripts/osm-region-catalog.sh"

DOWNLOAD_LIBRARY_ONLY="${ROGUEROUTE_OSM_DOWNLOAD_LIBRARY_ONLY:-false}"
if [[ "$DOWNLOAD_LIBRARY_ONLY" != "true" ]]; then
  print_header "RogueRoute GPX v12 OSM Download"
  bootstrap_env_file osrm
  load_env_values
  mkdir -p "$OSRM_DATA_DIR"
  ensure_osm_region_env_catalog
fi

DOWNLOAD_RETRIES="${OSM_DOWNLOAD_RETRIES:-5}"
VERIFY_FULL="${OSM_VERIFY_FULL:-true}"
[[ "$DOWNLOAD_RETRIES" =~ ^[0-9]+$ && "$DOWNLOAD_RETRIES" -ge 1 ]] || fail "OSM_DOWNLOAD_RETRIES must be a positive integer. Current: $DOWNLOAD_RETRIES"

usage() {
  cat <<USAGE
Usage:
  ./download-osm.sh list                    # catalogue plus local file status
  ./download-osm.sh <region-key>            # download/resume and verify one region
  ./download-osm.sh popular
  ./download-osm.sh core
  ./download-osm.sh all
  ./download-osm.sh custom <url> <graph-base>

Examples:
  ./download-osm.sh new-zealand
  ./download-osm.sh australia
  ./download-osm.sh popular

Downloads resume from .part files, retry transient failures, validate the OSM
PBF before publishing it, and print a complete batch summary. A failed region
does not prevent later regions in the same batch from being attempted.

Data folder: $OSRM_DATA_DIR
USAGE
}

find_region() { region_from_catalog "$1"; }

pbf_status() {
  local pbf="$1" final="$OSRM_DATA_DIR/$1" part="$OSRM_DATA_DIR/$1.part"
  local -a recoverable=()
  if [[ -f "$final" ]]; then
    printf 'downloaded'
  elif [[ -f "$part" ]]; then
    printf 'partial'
  else
    shopt -s nullglob
    recoverable=("${part}.invalid-"*)
    shopt -u nullglob
    if (( ${#recoverable[@]} > 0 )); then
      printf 'recoverable'
    else
      printf 'missing'
    fi
  fi
}

list_regions() {
  printf '%-28s %-31s %-12s %-12s %-14s %-9s\n' "KEY" "REGION" "DOWNLOAD" "PBF" "OSRM EXPANDED" "GROUP"
  while IFS='|' read -r key label url graph rough expanded priority; do
    [[ -z "$key" ]] && continue
    printf '%-28s %-31s %-12s %-12s %-14s %-9s\n' \
      "$key" "$label" "$(pbf_status "${graph}-latest.osm.pbf")" "$rough" "$expanded" "$priority"
  done <<< "$OSM_REGION_CATALOG"
}

register_region_env() {
  local key="$1" pbf="$2"
  set_env_var "$(region_env_name "$key")" "$pbf"
}

validate_pbf() {
  local file="$1"
  if [[ ! -s "$file" ]]; then
    warn "Downloaded file is empty: $file"
    return 1
  fi

  # The PBF BlobHeader contains the literal OSMHeader near the start. This
  # catches HTML/error responses even when osmium-tool is not installed.
  if ! LC_ALL=C grep -a -m1 -q 'OSMHeader' "$file"; then
    warn "File does not contain an OSM PBF header: $file"
    return 1
  fi

  if command -v osmium >/dev/null 2>&1; then
    local -a osmium_args=(fileinfo)
    [[ "$VERIFY_FULL" == "true" ]] && osmium_args+=(-e)
    # Always supply the format. osmium otherwise infers it from the final
    # extension and rejects valid temporary names such as *.osm.pbf.part.
    osmium_args+=(-F pbf)
    local osmium_error=""
    if ! osmium_error="$(osmium "${osmium_args[@]}" "$file" 2>&1 >/dev/null)"; then
      warn "osmium validation failed: $file${osmium_error:+ ($osmium_error)}"
      return 1
    fi
  else
    warn "osmium-tool is unavailable; header validation passed, but a full structural check was skipped."
  fi
}

recover_preserved_download() {
  local part="$1" final="$2" index candidate
  local -a candidates=()
  shopt -s nullglob
  candidates=("${part}.invalid-"*)
  shopt -u nullglob

  for ((index = ${#candidates[@]} - 1; index >= 0; index -= 1)); do
    candidate="${candidates[$index]}"
    log "Checking preserved download: $candidate"
    if validate_pbf "$candidate"; then
      mv -- "$candidate" "$final"
      log "Recovered previously downloaded PBF without downloading it again: $final"
      return 0
    fi
  done
  return 1
}

download_to_part() {
  local url="$1" part="$2"
  if command -v curl >/dev/null 2>&1; then
    curl \
      --location \
      --fail \
      --continue-at - \
      --retry "$DOWNLOAD_RETRIES" \
      --retry-all-errors \
      --retry-delay 3 \
      --connect-timeout 30 \
      --speed-limit 1024 \
      --speed-time 90 \
      --output "$part" \
      "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget \
      --continue \
      --tries="$DOWNLOAD_RETRIES" \
      --timeout=30 \
      --output-document="$part" \
      "$url"
  else
    warn "curl or wget is required"
    return 1
  fi
}

download_file() {
  local url="$1" pbf="$2" final="$OSRM_DATA_DIR/$2" part="$OSRM_DATA_DIR/$2.part"
  local stamp

  if [[ -f "$final" ]]; then
    if validate_pbf "$final"; then
      log "Verified existing download: $final"
      return 0
    fi
    stamp="$(date +%Y%m%d-%H%M%S)"
    warn "Preserving invalid existing file as: ${final}.invalid-${stamp}"
    mv -- "$final" "${final}.invalid-${stamp}"
  fi

  if [[ -f "$part" ]] && validate_pbf "$part"; then
    mv -- "$part" "$final"
    log "Published already-complete partial download: $final"
    return 0
  fi

  if recover_preserved_download "$part" "$final"; then
    return 0
  fi

  log "Downloading (or resuming): $url"
  if ! download_to_part "$url" "$part"; then
    warn "Download failed; resumable data remains at: $part"
    return 1
  fi

  if ! validate_pbf "$part"; then
    stamp="$(date +%Y%m%d-%H%M%S)"
    warn "Preserving invalid partial file as: ${part}.invalid-${stamp}"
    mv -- "$part" "${part}.invalid-${stamp}"
    return 1
  fi

  mv -- "$part" "$final"
  log "Download verified and published: $final"
}

download_one() {
  local requested_key="$1" line key label url graph rough expanded priority pbf
  line="$(find_region "$requested_key")"
  if [[ -z "$line" ]]; then
    warn "Unknown OSM region: $requested_key. Run ./download-osm.sh list"
    return 1
  fi

  IFS='|' read -r key label url graph rough expanded priority <<< "$line"
  pbf="${graph}-latest.osm.pbf"
  echo ""
  log "Region: $label ($key)"
  log "Target: $OSRM_DATA_DIR/$pbf"
  log "Rough sizes: download $rough, expanded OSRM $expanded"

  download_file "$url" "$pbf" || return 1
  register_region_env "$key" "$pbf"
  log "Registered: $(region_env_name "$key")=$pbf"

  if [[ -z "${OSRM_ACTIVE_REGION:-}" || "${OSRM_ACTIVE_REGION:-australia}" == "planet" ]]; then
    set_env_var OSRM_ACTIVE_REGION "$key"
    set_env_var OSRM_PBF "$pbf"
    set_env_var OSRM_GRAPH "${graph}.osrm"
    log "Set active region to $key because no usable active region was configured."
  fi
  log "Next step: ./prepare-osrm.sh region $key"
}

download_many() {
  local keys=("$@") key completed=0 failed=0
  local -a failed_keys=()

  for key in "${keys[@]}"; do
    if download_one "$key"; then
      completed=$((completed + 1))
    else
      failed=$((failed + 1))
      failed_keys+=("$key")
      warn "Region failed: $key. Continuing with the batch."
    fi
  done

  echo ""
  log "Download batch complete. Requested: ${#keys[@]}. Verified: $completed. Failed: $failed."
  if (( failed > 0 )); then
    warn "Failed region key(s): ${failed_keys[*]}"
    warn "Run the same command again to resume .part downloads, or retry one key directly."
    return 1
  fi
}

download_by_group() {
  local group="$1"
  local -a keys=()
  mapfile -t keys < <(awk -F'|' -v wanted="$group" '$7 == wanted { print $1 }' <<< "$OSM_REGION_CATALOG")
  download_many "${keys[@]}"
}

download_custom() {
  local url="$1" graph="$2" key="custom-${2}" pbf="${2}-latest.osm.pbf"
  [[ "$url" =~ ^https?:// ]] || fail "Custom URL must start with http:// or https://"
  [[ "$graph" =~ ^[A-Za-z0-9_-]+$ ]] || fail "Custom graph base may contain only letters, numbers, underscores, and dashes"
  download_file "$url" "$pbf"
  register_region_env "$key" "$pbf"
  log "Downloaded, verified, and registered: $OSRM_DATA_DIR/$pbf"
}

if [[ "$DOWNLOAD_LIBRARY_ONLY" == "true" ]]; then
  return 0 2>/dev/null || exit 0
fi

cmd="${1:-list}"
case "$cmd" in
  list|status) list_regions ;;
  core) download_by_group core ;;
  popular)
    download_many australia new-zealand japan south-korea taiwan singapore-malaysia-brunei us hawaii canada mexico uk-ireland germany france spain italy netherlands
    ;;
  all)
    warn "This downloads many very large files. Europe, US, and South America can require substantial disk space."
    [[ "${2:-}" == "--yes" ]] || sleep 8
    mapfile -t all_keys < <(awk -F'|' 'NF { print $1 }' <<< "$OSM_REGION_CATALOG")
    download_many "${all_keys[@]}"
    ;;
  custom) download_custom "${2:-}" "${3:-custom}" ;;
  -h|--help|help) usage ;;
  *) download_many "$cmd" ;;
esac
