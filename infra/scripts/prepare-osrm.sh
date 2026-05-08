#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
source "$REPO_ROOT/scripts/osm-region-catalog.sh"

print_header "RogueRoute GPX v10 OSRM Prepare"
bootstrap_env_file osrm
load_env_values
mkdir -p "$OSRM_DATA_DIR"

OSRM_THREADS="${OSRM_THREADS:-8}"
OSRM_IMAGE="${OSRM_IMAGE:-osrm/osrm-backend:latest}"

# Rev10.6 safety rule:
#   prepare-osrm.sh must never delete downloaded inputs or existing prepared outputs.
#   --force moves old .osrm* outputs into _osrm-backups/ before rebuilding.
BACKUP_ROOT="$OSRM_DATA_DIR/_osrm-backups"

find_region() {
  local wanted="$1"
  echo "$OSM_REGION_CATALOG" | awk -F'|' -v k="$wanted" '$1==k {print; exit}'
}

strip_osrm_data_prefix() {
  local path="$1"
  if [[ "$path" = /* ]]; then
    path="$(realpath -m "$path")"
    local root
    root="$(realpath -m "$OSRM_DATA_DIR")"
    [[ "$path" == "$root/"* ]] || fail "PBF must be inside OSRM_DATA_DIR ($OSRM_DATA_DIR): $path"
    path="${path#"$root/"}"
  fi
  path="${path#./}"
  [[ "$path" != *".."* ]] || fail "Refusing unsafe PBF path: $path"
  printf '%s\n' "$path"
}

derive_graph_from_pbf() {
  local pbf="$1"
  [[ "$pbf" == *.osm.pbf ]] || fail "PBF must end in .osm.pbf: $pbf"
  printf '%s\n' "${pbf%.osm.pbf}.osrm"
}

select_region() {
  local key="$1" line label url graph rough expanded priority
  [[ -n "$key" ]] || fail "Usage: ./prepare-osrm.sh region <region-key>"
  line="$(find_region "$key")"; [[ -n "$line" ]] || fail "Unknown region: $key. Run ./download-osm.sh list"
  IFS='|' read -r SELECTED_REGION_KEY label url graph rough expanded priority <<< "$line"
  OSRM_PBF="${graph}-latest.osm.pbf"
  OSRM_GRAPH="$(derive_graph_from_pbf "$OSRM_PBF")"
  log "Selected region: $label"
}

select_pbf() {
  local pbf="$1"
  [[ -n "$pbf" ]] || fail "Usage: ./prepare-osrm.sh pbf <file.osm.pbf>"
  pbf="$(strip_osrm_data_prefix "$pbf")"
  [[ "$pbf" == *.osm.pbf ]] || fail "PBF must end in .osm.pbf"
  [[ -f "$OSRM_DATA_DIR/$pbf" ]] || fail "Missing PBF: $OSRM_DATA_DIR/$pbf"
  OSRM_PBF="$pbf"
  OSRM_GRAPH="$(derive_graph_from_pbf "$OSRM_PBF")"
  unset SELECTED_REGION_KEY || true
  log "Selected local PBF: $OSRM_PBF"
}

select_env_default() {
  OSRM_PBF="$(strip_osrm_data_prefix "${OSRM_PBF:-australia-latest.osm.pbf}")"
  [[ -f "$OSRM_DATA_DIR/$OSRM_PBF" ]] || fail "Missing PBF: $OSRM_DATA_DIR/$OSRM_PBF"
  OSRM_GRAPH="$(derive_graph_from_pbf "$OSRM_PBF")"
}

validate_selection() {
  OSRM_PBF="$(strip_osrm_data_prefix "$OSRM_PBF")"
  OSRM_GRAPH="$(derive_graph_from_pbf "$OSRM_PBF")"
  [[ -f "$OSRM_DATA_DIR/$OSRM_PBF" ]] || fail "Missing PBF: $OSRM_DATA_DIR/$OSRM_PBF"
}

osrm_graph_is_ready() {
  local base="$1"
  [[ -f "$OSRM_DATA_DIR/${base}.osrm" ]] || return 1
  [[ -f "$OSRM_DATA_DIR/${base}.osrm.partition" ]] || return 1
  [[ -f "$OSRM_DATA_DIR/${base}.osrm.cells" ]] || return 1
  [[ -f "$OSRM_DATA_DIR/${base}.osrm.cell_metrics" ]] || return 1
  return 0
}

matching_osrm_outputs_exist() {
  local base="$1" dir name target_dir
  dir="$(dirname "$base")"
  name="$(basename "$base")"
  [[ "$dir" == "." ]] && dir=""
  target_dir="$OSRM_DATA_DIR${dir:+/$dir}"
  [[ -d "$target_dir" ]] || return 1
  find "$target_dir" -maxdepth 1 -type f -name "${name}.osrm*" -print -quit | grep -q .
}


graph_status() {
  local base="$1"
  if osrm_graph_is_ready "$base"; then
    echo "ready"
  elif matching_osrm_outputs_exist "$base"; then
    echo "partial"
  else
    echo "missing"
  fi
}

list_pbf_files() {
  local osrm_root
  osrm_root="$(realpath -m "$OSRM_DATA_DIR")"
  find "$osrm_root" \
    -type f \
    -name "*.osm.pbf" \
    -not -path "$osrm_root/_osrm-backups/*" \
    -not -path "*/_osrm-backups/*" \
    | sort
}

print_repair_table() {
  local osrm_root idx pbf_abs pbf_rel pbf_base status
  osrm_root="$(realpath -m "$OSRM_DATA_DIR")"
  mapfile -t repair_files < <(list_pbf_files)
  [[ "${#repair_files[@]}" -gt 0 ]] || fail "No .osm.pbf files found under OSRM_DATA_DIR: $OSRM_DATA_DIR"

  echo ""
  echo "Discovered .osm.pbf files under: $osrm_root"
  echo ""
  printf '%-5s %-10s %s\n' "Index" "Status" "PBF"
  printf '%-5s %-10s %s\n' "-----" "----------" "---"
  idx=0
  for pbf_abs in "${repair_files[@]}"; do
    idx=$((idx + 1))
    pbf_rel="${pbf_abs#$osrm_root/}"
    pbf_base="${pbf_rel%.osm.pbf}"
    status="$(graph_status "$pbf_base")"
    printf '%-5s %-10s %s\n' "$idx" "$status" "$pbf_rel"
  done
  echo ""
  echo "Status guide: ready = usable, partial = broken/stale .osrm* outputs, missing = not prepared yet."
}

resolve_repair_target() {
  local target="$1" osrm_root pbf_abs pbf_rel file base
  osrm_root="$(realpath -m "$OSRM_DATA_DIR")"
  mapfile -t repair_files < <(list_pbf_files)
  [[ "${#repair_files[@]}" -gt 0 ]] || fail "No .osm.pbf files found under OSRM_DATA_DIR: $OSRM_DATA_DIR"

  if [[ "$target" =~ ^[0-9]+$ ]]; then
    (( target >= 1 && target <= ${#repair_files[@]} )) || fail "Repair index out of range: $target"
    pbf_abs="${repair_files[$((target - 1))]}"
    printf '%s\n' "${pbf_abs#$osrm_root/}"
    return 0
  fi

  target="${target#./}"
  if [[ "$target" = /* ]]; then
    strip_osrm_data_prefix "$target"
    return 0
  fi

  # Exact relative path match first.
  for pbf_abs in "${repair_files[@]}"; do
    pbf_rel="${pbf_abs#$osrm_root/}"
    [[ "$pbf_rel" == "$target" ]] && { printf '%s\n' "$pbf_rel"; return 0; }
  done

  # Then basename match, allowing either file.osm.pbf or file.
  for pbf_abs in "${repair_files[@]}"; do
    pbf_rel="${pbf_abs#$osrm_root/}"
    file="$(basename "$pbf_rel")"
    base="${file%.osm.pbf}"
    if [[ "$file" == "$target" || "$base" == "$target" ]]; then
      printf '%s\n' "$pbf_rel"
      return 0
    fi
  done

  fail "Could not find repair target '$target'. Run: ./prepare-osrm.sh repair list"
}

repair_one_pbf() {
  local pbf_rel="$1" status base
  select_pbf "$pbf_rel"
  base="${OSRM_GRAPH%.osrm}"
  status="$(graph_status "$base")"

  case "$status" in
    ready)
      if [[ "$FORCE_REBUILD" == "true" ]]; then
        warn "Repair target is already ready, but --force was supplied. Rebuilding: $OSRM_PBF"
        build_selected true
      else
        log "Repair target is already ready. Skipping: $OSRM_PBF"
      fi
      ;;
    partial)
      warn "Repair target has partial/stale OSRM outputs: $OSRM_PBF"
      warn "Old matching .osrm* outputs will be moved to _osrm-backups before rebuild. The .osm.pbf input is preserved."
      build_selected true
      ;;
    missing)
      log "Repair target is missing prepared OSRM outputs. Preparing now: $OSRM_PBF"
      build_selected false
      ;;
    *)
      fail "Unknown repair status for $OSRM_PBF: $status"
      ;;
  esac
}

repair_all_pbf() {
  local osrm_root pbf_abs pbf_rel total current failed=0
  osrm_root="$(realpath -m "$OSRM_DATA_DIR")"
  mapfile -t repair_files < <(list_pbf_files)
  [[ "${#repair_files[@]}" -gt 0 ]] || fail "No .osm.pbf files found under OSRM_DATA_DIR: $OSRM_DATA_DIR"
  total="${#repair_files[@]}"
  current=0

  for pbf_abs in "${repair_files[@]}"; do
    current=$((current + 1))
    pbf_rel="${pbf_abs#$osrm_root/}"
    echo ""
    log "---- repair item ${current}/${total}: ${pbf_rel} ----"
    if repair_one_pbf "$pbf_rel"; then
      log "Repair pass completed for: $pbf_rel"
    else
      failed=$((failed + 1))
      warn "Repair failed for: $pbf_rel. Continuing."
    fi
  done

  [[ "$failed" -eq 0 ]] || fail "Repair completed with $failed failed item(s)."
}

cleanup_old_backups() {
  local days="$1"
  [[ "$days" =~ ^[0-9]+$ ]] || fail "Backup cleanup days must be numeric. Current: $days"
  [[ -d "$BACKUP_ROOT" ]] || { log "No OSRM backup folder exists yet: $BACKUP_ROOT"; return 0; }
  warn "This deletes backup folders older than $days day(s) under: $BACKUP_ROOT"
  warn "It never deletes .osm.pbf inputs or active .osrm* outputs."
  if [[ "$YES" != "true" ]]; then
    read -r -p "Continue deleting old backup folders? [y/N]: " reply || true
    case "${reply,,}" in y|yes) ;; *) log "Backup cleanup cancelled."; return 0 ;; esac
  fi
  find "$BACKUP_ROOT" -mindepth 1 -type d -mtime "+$days" -print -exec rm -rf {} +
  log "Old backup cleanup complete."
}

backup_osrm_graph_outputs() {
  local base="$1"
  [[ -n "$base" ]] || fail "Refusing to move OSRM outputs because graph base is empty"
  [[ "$base" != /* && "$base" != *".."* ]] || fail "Refusing unsafe graph base: $base"

  local dir name target_dir stamp backup_dir found=false
  dir="$(dirname "$base")"
  name="$(basename "$base")"
  [[ "$dir" == "." ]] && dir=""
  target_dir="$OSRM_DATA_DIR${dir:+/$dir}"
  [[ -d "$target_dir" ]] || return 0

  stamp="$(date +%Y%m%d-%H%M%S)"
  backup_dir="$BACKUP_ROOT/${dir:+$dir/}${name}-$stamp"
  mkdir -p "$backup_dir"

  while IFS= read -r -d '' file; do
    found=true
    log "Preserving existing OSRM output: ${file#$OSRM_DATA_DIR/} -> ${backup_dir#$OSRM_DATA_DIR/}/"
    mv -- "$file" "$backup_dir/"
  done < <(find "$target_dir" -maxdepth 1 -type f -name "${name}.osrm*" -print0)

  if [[ "$found" == "false" ]]; then
    rmdir "$backup_dir" 2>/dev/null || true
  else
    log "Existing prepared outputs were moved, not deleted: $backup_dir"
  fi
}

build_selected() {
  local force_rebuild="${1:-false}"
  validate_selection
  # Do not call check_osrm_data here: it reloads infra/docker/.env and would
  # reset OSRM_PBF/OSRM_GRAPH back to the active/default region during
  # all-downloaded/repair loops. ensure_osrm_mount_available also reloads env,
  # so preserve and restore the in-memory selection around that safety check.
  local selected_pbf="$OSRM_PBF"
  local selected_graph="$OSRM_GRAPH"
  ensure_osrm_mount_available
  OSRM_PBF="$selected_pbf"
  OSRM_GRAPH="$selected_graph"

  local graph_base="${OSRM_GRAPH%.osrm}"
  [[ "$OSRM_PBF" == "planet.osm.pbf" ]] && warn "Planet preprocessing can require 500GB+ free disk and substantially more than 128GB RAM for foot profile. Regional extracts are strongly recommended."
  log "Preparing OSRM using /opt/${OSRM_PROFILE}.lua"
  log "Threads: $OSRM_THREADS"
  log "Input preserved: $OSRM_DATA_DIR/$OSRM_PBF"
  log "Output graph base: $OSRM_DATA_DIR/$OSRM_GRAPH"

  if osrm_graph_is_ready "$graph_base" && [[ "$force_rebuild" != "true" ]]; then
    log "Prepared OSRM graph already exists. Skipping extract/partition/customize."
    log "Moving to the next file, if any. Use --force only when you intentionally want a new build."
  else
    if [[ "$force_rebuild" == "true" ]]; then
      backup_osrm_graph_outputs "$graph_base"
    elif matching_osrm_outputs_exist "$graph_base"; then
      warn "Partial OSRM graph found for $OSRM_GRAPH but required MLD sidecars are missing."
      warn "No files were removed. Re-run this one region with --force to move old .osrm* outputs into _osrm-backups and rebuild."
      return 0
    fi

    docker run --rm -t -v "$OSRM_DATA_DIR:/data" "$OSRM_IMAGE" \
      osrm-extract --threads "$OSRM_THREADS" -p "/opt/${OSRM_PROFILE}.lua" "/data/${OSRM_PBF}"
    docker run --rm -t -v "$OSRM_DATA_DIR:/data" "$OSRM_IMAGE" \
      osrm-partition "/data/${OSRM_GRAPH}"
    docker run --rm -t -v "$OSRM_DATA_DIR:/data" "$OSRM_IMAGE" \
      osrm-customize "/data/${OSRM_GRAPH}"
  fi

  set_env_var OSRM_PBF "$OSRM_PBF"
  set_env_var OSRM_GRAPH "$OSRM_GRAPH"
  if [[ -n "${SELECTED_REGION_KEY:-}" ]]; then
    set_env_var OSRM_ACTIVE_REGION "$SELECTED_REGION_KEY"
    set_env_var "$(region_env_name "$SELECTED_REGION_KEY")" "$OSRM_PBF"
  fi
  log "OSRM graph ready or preserved: $OSRM_DATA_DIR/$OSRM_GRAPH"
}

FORCE_REBUILD=false
YES=false
BACKUP_CLEANUP_DAYS=14
ARGS=()
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --force|-f) FORCE_REBUILD=true; shift ;;
    --yes|-y) YES=true; shift ;;
    --days)
      [[ -n "${2:-}" ]] || fail "--days requires a number"
      BACKUP_CLEANUP_DAYS="$2"
      shift 2
      ;;
    --days=*) BACKUP_CLEANUP_DAYS="${1#--days=}"; shift ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
set -- "${ARGS[@]}"

case "${1:-env}" in
  env|"") select_env_default; build_selected "$FORCE_REBUILD" ;;
  region) select_region "${2:-}"; build_selected "$FORCE_REBUILD" ;;
  pbf) select_pbf "${2:-}"; build_selected "$FORCE_REBUILD" ;;
  repair)
    subcommand="${2:-}"
    case "$subcommand" in
      ""|list|status)
        print_repair_table
        ;;
      all)
        warn "Repair-all will inspect every .osm.pbf under $OSRM_DATA_DIR."
        warn "Ready graphs are skipped unless --force is supplied. Partial outputs are moved to _osrm-backups, not deleted."
        [[ "$YES" == "true" ]] || sleep 5
        repair_all_pbf
        ;;
      *)
        repair_target="$(resolve_repair_target "$subcommand")"
        log "Selected repair target: $repair_target"
        repair_one_pbf "$repair_target"
        ;;
    esac
    ;;
  cleanup-backups|prune-backups)
    cleanup_old_backups "$BACKUP_CLEANUP_DAYS"
    ;;
  all-downloaded)
    warn "This will build every *.osm.pbf under $OSRM_DATA_DIR recursively."
    warn "Safety: downloaded inputs are never deleted; existing .osrm* outputs are skipped unless --force is used."
    if [[ "$FORCE_REBUILD" == "true" ]]; then
      warn "--force will MOVE matching old .osrm* outputs to _osrm-backups; it will not delete them."
    fi
    [[ "$YES" == "true" ]] || sleep 8

    # Rev10.9: deterministic all-downloaded mode.
    # Do not use the active/default region, and do not reload .env inside this loop.
    # Every discovered .osm.pbf is processed by its path relative to OSRM_DATA_DIR.
    osrm_root="$(realpath -m "$OSRM_DATA_DIR")"
    mapfile -t pbf_files < <(find "$osrm_root" \
      -type f \
      -name "*.osm.pbf" \
      -not -path "$osrm_root/_osrm-backups/*" \
      -not -path "*/_osrm-backups/*" \
      | sort)

    [[ "${#pbf_files[@]}" -gt 0 ]] || fail "No .osm.pbf files found under OSRM_DATA_DIR: $OSRM_DATA_DIR"

    log "Discovered ${#pbf_files[@]} downloaded .osm.pbf file(s):"
    for file in "${pbf_files[@]}"; do
      log " - ${file#$osrm_root/}"
    done

    processed=0
    skipped=0
    failed=0
    total="${#pbf_files[@]}"

    for pbf_abs in "${pbf_files[@]}"; do
      processed=$((processed + 1))
      pbf_rel="${pbf_abs#$osrm_root/}"
      pbf_base="${pbf_rel%.osm.pbf}"
      graph_rel="${pbf_base}.osrm"

      echo ""
      log "---- all-downloaded item ${processed}/${total}: ${pbf_rel} ----"

      if [[ "$pbf_abs" == "$pbf_rel" ]]; then
        failed=$((failed + 1))
        warn "Could not convert to an OSRM_DATA_DIR-relative path: $pbf_abs. Continuing."
        continue
      fi

      if osrm_graph_is_ready "$pbf_base" && [[ "$FORCE_REBUILD" != "true" ]]; then
        skipped=$((skipped + 1))
        log "Prepared OSRM graph already exists for ${pbf_rel}. Skipping and moving to next file."
        continue
      fi

      if [[ "$FORCE_REBUILD" == "true" ]]; then
        backup_osrm_graph_outputs "$pbf_base"
      elif matching_osrm_outputs_exist "$pbf_base"; then
        skipped=$((skipped + 1))
        warn "Partial OSRM graph found for ${graph_rel}; no files were removed."
        warn "Use --force --yes to move matching .osrm* outputs to _osrm-backups and rebuild this item. Continuing."
        continue
      fi

      log "Preparing OSRM using /opt/${OSRM_PROFILE}.lua"
      log "Threads: $OSRM_THREADS"
      log "Input preserved: $pbf_abs"
      log "Output graph base: $osrm_root/$graph_rel"

      if docker run --rm -t -v "$osrm_root:/data" "$OSRM_IMAGE" \
        osrm-extract --threads "$OSRM_THREADS" -p "/opt/${OSRM_PROFILE}.lua" "/data/${pbf_rel}" && \
        docker run --rm -t -v "$osrm_root:/data" "$OSRM_IMAGE" \
        osrm-partition "/data/${graph_rel}" && \
        docker run --rm -t -v "$osrm_root:/data" "$OSRM_IMAGE" \
        osrm-customize "/data/${graph_rel}"; then
        log "Completed: ${pbf_rel}"
      else
        failed=$((failed + 1))
        warn "Failed processing ${pbf_rel}. Continuing to next file."
      fi
    done

    log "all-downloaded complete. Discovered: $total. Visited: $processed. Skipped: $skipped. Failed: $failed."
    [[ "$failed" -eq 0 ]] || exit 1
    ;;
  -h|--help|help)
    cat <<USAGE
Usage:
  ./prepare-osrm.sh                         # build OSRM_PBF from infra/docker/.env; skips if already ready
  ./prepare-osrm.sh --force                 # move old .osrm* outputs to _osrm-backups, then rebuild current graph
  ./prepare-osrm.sh region australia
  ./prepare-osrm.sh region australia --force
  ./prepare-osrm.sh pbf australia-latest.osm.pbf
  ./prepare-osrm.sh pbf subdir/file.osm.pbf
  ./prepare-osrm.sh pbf /mnt/h/osrm/subdir/file.osm.pbf
  ./prepare-osrm.sh all-downloaded          # recursively build all downloaded .osm.pbf files; skips ready graphs
  ./prepare-osrm.sh all-downloaded --force  # recursively rebuild all .osm.pbf files; old .osrm* files are moved, not deleted
  ./prepare-osrm.sh all-downloaded --yes    # skip the safety delay
  ./prepare-osrm.sh repair list              # show every downloaded PBF and status: ready, partial, or missing
  ./prepare-osrm.sh repair 3                 # repair the third PBF from the repair list
  ./prepare-osrm.sh repair australia-latest  # repair by basename
  ./prepare-osrm.sh repair subdir/file.osm.pbf
  ./prepare-osrm.sh repair all --yes         # repair every missing/partial graph and skip ready graphs
  ./prepare-osrm.sh repair all --force --yes # rebuild every graph, moving old .osrm* outputs to _osrm-backups
  ./prepare-osrm.sh cleanup-backups --days 14 --yes # delete old backup folders only
USAGE
    ;;
  *) fail "Unknown prepare mode: ${1:-}" ;;
esac
