#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$REPO_ROOT/infra/docker"
ENV_FILE="$DOCKER_DIR/.env"
ENV_EXAMPLE="$DOCKER_DIR/.env.example"

log() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[ERROR] $*"; exit 1; }

ensure_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

ensure_core_tools() {
  ensure_command git
  ensure_command docker
  docker compose version >/dev/null 2>&1 || fail "docker compose is not available"
}

ensure_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    fail "Missing $ENV_FILE . Copy $ENV_EXAMPLE to $ENV_FILE first."
  fi
}

ensure_media_net() {
  docker network inspect media-net >/dev/null 2>&1 || warn "Docker network 'media-net' does not exist yet. Create it if your stack expects an external network."
}

enable_pnpm() {
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
    corepack prepare pnpm@10.12.1 --activate >/dev/null 2>&1 || true
  fi
  command -v pnpm >/dev/null 2>&1 || fail "pnpm is not available. Install it with: sudo npm install -g pnpm@10.12.1"
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

check_valhalla_data() {
  load_env_values
  [[ -n "${VALHALLA_DATA_PATH:-}" ]] || fail "VALHALLA_DATA_PATH is not set in $ENV_FILE"
  [[ -d "$VALHALLA_DATA_PATH" ]] || fail "VALHALLA_DATA_PATH does not exist: $VALHALLA_DATA_PATH"
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
