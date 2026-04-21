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
