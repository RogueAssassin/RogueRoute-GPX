#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.env"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

log() { printf '[INFO] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; }
fail() { printf '[ERROR] %s\n' "$*" >&2; exit 1; }

require_docker() {
  command -v docker >/dev/null 2>&1 || fail "Docker is required. Install Docker Engine and the Compose plugin first."
  docker compose version >/dev/null 2>&1 || fail "The Docker Compose plugin is required."
}

set_env_value() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

get_env_value() {
  local key="$1" fallback="${2:-}"
  local value
  value="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
  printf '%s\n' "${value:-$fallback}"
}

ensure_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    cp "$ROOT_DIR/.env.example" "$ENV_FILE"
    log "Created $ENV_FILE"
  fi
  if [[ -z "$(get_env_value NEXT_SERVER_ACTIONS_ENCRYPTION_KEY)" ]]; then
    command -v openssl >/dev/null 2>&1 || fail "openssl is required to generate the server encryption key."
    set_env_value NEXT_SERVER_ACTIONS_ENCRYPTION_KEY "$(openssl rand -base64 32)"
    log "Generated a persistent server encryption key."
  fi
  set_env_value ROGUEROUTE_IMAGE_TAG "$(get_env_value ROGUEROUTE_IMAGE_TAG v12)"
  set_env_value NEXT_PUBLIC_APP_VERSION "$(get_env_value NEXT_PUBLIC_APP_VERSION v12)"
  set_env_value OSRM_SNAP_MAX_RADIUS_METERS "$(get_env_value OSRM_SNAP_MAX_RADIUS_METERS 5000)"
  chmod 600 "$ENV_FILE" 2>/dev/null || true
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

verify_graph() {
  local data_dir graph prefix
  data_dir="$(get_env_value OSRM_DATA_DIR /mnt/h/osrm)"
  graph="$(get_env_value OSRM_GRAPH australia-latest.osrm)"
  prefix="${graph%.osrm}"
  [[ -d "$data_dir" ]] || fail "OSRM_DATA_DIR does not exist: $data_dir"
  [[ -f "$data_dir/${prefix}.osrm.mldgr" ]] || fail "Prepared MLD graph is missing: $data_dir/${prefix}.osrm.mldgr"
  [[ -f "$data_dir/${prefix}.osrm.partition" ]] || fail "Prepared partition is missing: $data_dir/${prefix}.osrm.partition"
  [[ -f "$data_dir/${prefix}.osrm.cell_metrics" ]] || fail "Prepared cell metrics are missing: $data_dir/${prefix}.osrm.cell_metrics"
}
