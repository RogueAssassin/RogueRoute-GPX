#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$REPO_ROOT/infra/docker"
ENV_FILE="$DOCKER_DIR/.env"
ENV_EXAMPLE="$DOCKER_DIR/.env.example"
EXPECTED_NODE_MAJOR="24"
EXPECTED_NODE_VERSION="24.15.0"
EXPECTED_COREPACK_VERSION="0.34.7"
EXPECTED_DOCKER_VERSION="29.4.1"
EXPECTED_PNPM_VERSION="10.33.1"

log() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[ERROR] $*"; exit 1; }

ensure_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

ensure_core_tools() {
  ensure_command docker
  docker compose version >/dev/null 2>&1 || fail "docker compose is not available"
}

ensure_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    fail "Missing $ENV_FILE . Copy $ENV_EXAMPLE to $ENV_FILE first."
  fi
}

ensure_media_net() {
  if ! docker network inspect media-net >/dev/null 2>&1; then
    warn "Docker network 'media-net' does not exist yet. Creating it now."
    docker network create media-net >/dev/null
  fi
}

ensure_node_version() {
  ensure_command node
  local detected major
  detected="$(node -v 2>/dev/null || true)"
  major="${detected#v}"
  major="${major%%.*}"
  [[ -n "$major" ]] || fail "Unable to determine Node.js version."
  if [[ "$major" != "$EXPECTED_NODE_MAJOR" ]]; then
    fail "Node.js v$EXPECTED_NODE_MAJOR is required. Supported standard: Node.js $EXPECTED_NODE_VERSION. Detected: ${detected:-unknown}. Install Node $EXPECTED_NODE_VERSION and try again."
  fi
}

enable_pnpm() {
  if command -v corepack >/dev/null 2>&1; then
    log "Preparing pnpm via Corepack (pnpm@$EXPECTED_PNPM_VERSION)"
    corepack enable >/dev/null 2>&1 || true
    corepack prepare "pnpm@$EXPECTED_PNPM_VERSION" --activate >/dev/null 2>&1 || true
  else
    warn "Corepack was not found. pnpm must already be installed manually."
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    fail "pnpm is not available. Install Node.js $EXPECTED_NODE_VERSION with Corepack enabled, or run: sudo npm install -g pnpm@$EXPECTED_PNPM_VERSION"
  fi
}

load_env_values() {
  [[ -f "$ENV_FILE" ]] || return 0
  VALHALLA_DATA_PATH=$(grep -E '^VALHALLA_DATA_PATH=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  HOST_PORT=$(grep -E '^HOST_PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  PORT=$(grep -E '^PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  VALHALLA_PREFER_PBF_REBUILD=$(grep -E '^VALHALLA_PREFER_PBF_REBUILD=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  VALHALLA_SMART_REPAIR=$(grep -E '^VALHALLA_SMART_REPAIR=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  : "${VALHALLA_PREFER_PBF_REBUILD:=true}"
  : "${VALHALLA_SMART_REPAIR:=true}"
}

check_port_free() {
  local port="$1"
  [[ -n "$port" ]] || return 0
  if ss -tulpn 2>/dev/null | grep -q ":$port\b"; then
    warn "Port $port appears to be in use. Review with: sudo ss -tulpn | grep :$port"
  fi
}

ensure_mount_available() {
  [[ -n "${VALHALLA_DATA_PATH:-}" ]] || load_env_values
  [[ -n "${VALHALLA_DATA_PATH:-}" ]] || fail "VALHALLA_DATA_PATH is not set in $ENV_FILE"
  [[ -d "$VALHALLA_DATA_PATH" ]] || fail "VALHALLA_DATA_PATH does not exist: $VALHALLA_DATA_PATH"
  if command -v findmnt >/dev/null 2>&1; then
    if ! findmnt "$VALHALLA_DATA_PATH" >/dev/null 2>&1; then
      warn "VALHALLA_DATA_PATH exists but does not appear as a mounted filesystem. If this path should be on another drive, confirm the mount is active before starting Valhalla."
    fi
  fi
}

check_valhalla_data() {
  load_env_values
  ensure_mount_available
  local pbf_count
  pbf_count=$(find "$VALHALLA_DATA_PATH" -maxdepth 1 -type f -name '*.osm.pbf' | wc -l | tr -d ' ')
  if [[ "$pbf_count" == "0" && ! -e "$VALHALLA_DATA_PATH/valhalla_tiles.tar" && ! -d "$VALHALLA_DATA_PATH/valhalla_tiles" ]]; then
    fail "No .osm.pbf files, valhalla_tiles.tar, or valhalla_tiles directory found in $VALHALLA_DATA_PATH"
  fi
}

valhalla_source_mode() {
  load_env_values
  [[ -n "${VALHALLA_DATA_PATH:-}" ]] || { echo none; return 0; }
  local pbf_count planet_count
  pbf_count=$(find "$VALHALLA_DATA_PATH" -maxdepth 1 -type f -name '*.osm.pbf' | wc -l | tr -d ' ')
  planet_count=$(find "$VALHALLA_DATA_PATH" -maxdepth 1 -type f -name 'planet-latest.osm.pbf' | wc -l | tr -d ' ')

  if [[ -d "$VALHALLA_DATA_PATH/valhalla_tiles" || -f "$VALHALLA_DATA_PATH/valhalla_tiles.tar" ]]; then
    if [[ "$pbf_count" -gt 0 && "${VALHALLA_PREFER_PBF_REBUILD,,}" == "true" ]]; then
      if [[ "$planet_count" -gt 0 ]]; then echo planet-rebuild; else echo regional-rebuild; fi
    else
      echo tiles
    fi
    return 0
  fi

  if [[ "$planet_count" -gt 0 ]]; then echo planet; return 0; fi
  if [[ "$pbf_count" -gt 1 ]]; then echo regional; return 0; fi
  if [[ "$pbf_count" -eq 1 ]]; then echo single-pbf; return 0; fi
  echo none
}

verify_valhalla_outputs() {
  load_env_values
  ensure_mount_available

  local pbf_count tile_dir_count tar_size json_exists mode
  pbf_count=$(find "$VALHALLA_DATA_PATH" -maxdepth 1 -type f -name '*.osm.pbf' -size +0c | wc -l | tr -d ' ')
  tile_dir_count=0
  if [[ -d "$VALHALLA_DATA_PATH/valhalla_tiles" ]]; then
    tile_dir_count=$(find "$VALHALLA_DATA_PATH/valhalla_tiles" -mindepth 1 | wc -l | tr -d ' ')
  fi
  tar_size=0
  if [[ -f "$VALHALLA_DATA_PATH/valhalla_tiles.tar" ]]; then
    tar_size=$(wc -c < "$VALHALLA_DATA_PATH/valhalla_tiles.tar" | tr -d ' ')
  fi
  json_exists=false
  [[ -f "$VALHALLA_DATA_PATH/valhalla.json" ]] && json_exists=true
  mode=$(valhalla_source_mode)

  log "Valhalla data path: $VALHALLA_DATA_PATH"
  log "Detected mode: $mode"
  log "Detected .osm.pbf files: $pbf_count"
  [[ -f "$VALHALLA_DATA_PATH/planet-latest.osm.pbf" ]] && log "planet-latest.osm.pbf detected"
  if [[ -f "$VALHALLA_DATA_PATH/valhalla_tiles.tar" ]]; then
    log "valhalla_tiles.tar detected (${tar_size} bytes)"
    [[ "$tar_size" -gt 0 ]] || warn "valhalla_tiles.tar exists but is empty."
  fi
  if [[ -d "$VALHALLA_DATA_PATH/valhalla_tiles" ]]; then
    log "valhalla_tiles directory detected ($tile_dir_count entries)"
    [[ "$tile_dir_count" -gt 0 ]] || warn "valhalla_tiles directory exists but is empty."
  fi
  [[ "$json_exists" == true ]] && log "valhalla.json detected"

  if [[ "$json_exists" == true && ! -f "$VALHALLA_DATA_PATH/valhalla_tiles.tar" && ! -d "$VALHALLA_DATA_PATH/valhalla_tiles" ]]; then
    warn "valhalla.json exists without tiles. This usually means a broken or incomplete prior build."
  fi
  if [[ "$pbf_count" -gt 0 && ( -f "$VALHALLA_DATA_PATH/valhalla_tiles.tar" || -d "$VALHALLA_DATA_PATH/valhalla_tiles" ) && "${VALHALLA_PREFER_PBF_REBUILD,,}" == "true" ]]; then
    warn "Source PBF files and generated tiles both exist. Current settings prefer rebuilding from source files."
  fi

  case "$mode" in
    planet|regional|single-pbf)
      log "Recommended action: ./deploy-valhalla.sh to build fresh routing data."
      ;;
    planet-rebuild|regional-rebuild)
      log "Recommended action: ./deploy-valhalla.sh to purge stale generated outputs and rebuild from source PBF files."
      ;;
    tiles)
      log "Recommended action: ./restart-valhalla.sh to start using the existing tiles."
      ;;
    none)
      warn "Recommended action: add regional .osm.pbf files or existing Valhalla tiles to $VALHALLA_DATA_PATH first."
      ;;
  esac
}

remove_generated_valhalla_outputs() {
  [[ -n "${VALHALLA_DATA_PATH:-}" ]] || load_env_values
  [[ -n "${VALHALLA_DATA_PATH:-}" ]] || fail "VALHALLA_DATA_PATH is not set"
  log "Removing generated Valhalla outputs from $VALHALLA_DATA_PATH while preserving .osm.pbf source files"
  rm -rf "$VALHALLA_DATA_PATH/valhalla_tiles"
  rm -f "$VALHALLA_DATA_PATH/valhalla_tiles.tar"
  rm -f "$VALHALLA_DATA_PATH/valhalla.json"
  rm -f "$VALHALLA_DATA_PATH"/*.md5 "$VALHALLA_DATA_PATH"/*.hash 2>/dev/null || true
}

print_valhalla_plan() {
  local mode
  mode=$(valhalla_source_mode)
  case "$mode" in
    planet) log "Valhalla mode: full planet build from planet-latest.osm.pbf" ;;
    planet-rebuild) log "Valhalla mode: full planet rebuild. Existing tiles will be purged in favour of planet-latest.osm.pbf" ;;
    regional) log "Valhalla mode: regional build from multiple .osm.pbf files" ;;
    regional-rebuild) log "Valhalla mode: regional rebuild. Existing tiles will be purged in favour of .osm.pbf source files" ;;
    single-pbf) log "Valhalla mode: build from a single .osm.pbf file" ;;
    tiles) log "Valhalla mode: load existing tiles only" ;;
    none) warn "Valhalla mode: no usable source data detected yet" ;;
  esac
}

prepare_valhalla_data() {
  check_valhalla_data
  verify_valhalla_outputs
  load_env_values
  print_valhalla_plan
  local mode
  mode=$(valhalla_source_mode)
  case "$mode" in
    planet-rebuild|regional-rebuild)
      if [[ "${VALHALLA_SMART_REPAIR,,}" == "true" ]]; then
        warn "Smart repair is enabled. Existing generated tiles will be removed so Valhalla can rebuild from source PBF data."
        remove_generated_valhalla_outputs
      else
        warn "PBF files and generated tiles both exist. VALHALLA_SMART_REPAIR is disabled, so existing tiles will be left in place."
      fi
      ;;
  esac
}



is_git_checkout() {
  [[ -d "$REPO_ROOT/.git" ]]
}

update_repo_if_git_checkout() {
  if is_git_checkout; then
    log "Git checkout detected. Pulling latest changes"
    git -C "$REPO_ROOT" pull
  else
    log "Release ZIP detected. Skipping git pull"
  fi
}

print_restart_help() {
  echo
  log "Useful follow-up commands:"
  echo "  ./status.sh"
  echo "  ./logs.sh"
  echo "  ./logs-valhalla.sh"
  echo "  ./verify-valhalla.sh"
  echo "  ./repair-valhalla.sh"
}
