#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$REPO_ROOT/infra/docker"
ENV_FILE="$DOCKER_DIR/.env"
ENV_EXAMPLE="$DOCKER_DIR/.env.example"
ENV_STANDARD="$DOCKER_DIR/.env.standard"
ENV_VALHALLA="$DOCKER_DIR/.env.valhalla"
APP_VERSION="v8"
EXPECTED_NODE_MAJOR="24"
EXPECTED_NODE_VERSION="24.15.0"
EXPECTED_COREPACK_VERSION="0.34.7"
EXPECTED_DOCKER_VERSION="29.4.1"
EXPECTED_PNPM_VERSION="10.33.1"

log() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[ERROR] $*"; exit 1; }

print_header() {
  local title="${1:-RogueRoute GPX}"
  printf '\n'
  printf '╔════════════════════════════════════════════╗\n'
  printf '║ %-42s ║\n' "$title"
  printf '╚════════════════════════════════════════════╝\n'
}

print_step() {
  local current="$1"
  local total="$2"
  local message="$3"
  printf '\n[%s/%s] %s\n' "$current" "$total" "$message"
}

print_mode_summary() {
  local mode="${1:-standard}"
  case "$mode" in
    valhalla)
      echo "Mode selected: Valhalla"
      echo "Audience: intermediate / advanced users"
      echo "Focus: land-aware routing with self-hosted Valhalla"
      ;;
    *)
      echo "Mode selected: Standard"
      echo "Audience: beginner / most self-host users"
      echo "Focus: easiest setup and lowest resource usage"
      ;;
  esac
}

trim_value() {
  local raw="${1:-}"
  raw="${raw#"${raw%%[![:space:]]*}"}"
  raw="${raw%"${raw##*[![:space:]]}"}"
  printf '%s' "$raw"
}

normalize_mode() {
  local raw normalized
  raw="$(trim_value "${1:-standard}")"
  normalized="${raw,,}"
  case "$normalized" in
    ""|standard|std) echo "standard" ;;
    valhalla|val) echo "valhalla" ;;
    *) return 1 ;;
  esac
}

bootstrap_env_file() {
  local requested="${1:-standard}"
  local mode
  mode="$(normalize_mode "$requested")" || fail "Invalid mode: $requested. Use Standard or Valhalla."

  if [[ -f "$ENV_FILE" ]]; then
    log "Reusing existing env file: $ENV_FILE"
    return 0
  fi

  local template
  case "$mode" in
    standard) template="$ENV_STANDARD" ;;
    valhalla) template="$ENV_VALHALLA" ;;
  esac

  [[ -f "$template" ]] || fail "Missing env template: $template"
  cp "$template" "$ENV_FILE"
  log "Created $ENV_FILE from $(basename "$template")"
  if [[ "$mode" == "valhalla" ]]; then
    warn "Review VALHALLA_DATA_PATH in $ENV_FILE before the first Valhalla deploy."
  fi
}

ensure_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

ensure_core_tools() {
  ensure_command docker
  docker compose version >/dev/null 2>&1 || fail "docker compose is not available"
}

ensure_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    fail "Missing $ENV_FILE . Run bash ./fix-permissions.sh, then ./first-run.sh, or let the deploy script bootstrap it from .env.standard / .env.valhalla."
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
  ROUTER_MODE=$(grep -E '^ROUTER_MODE=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  VALHALLA_URL=$(grep -E '^VALHALLA_URL=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  VALHALLA_PREFER_PBF_REBUILD=$(grep -E '^VALHALLA_PREFER_PBF_REBUILD=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  VALHALLA_SMART_REPAIR=$(grep -E '^VALHALLA_SMART_REPAIR=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  NEXT_PUBLIC_APP_NAME=$(grep -E '^NEXT_PUBLIC_APP_NAME=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)

  VALHALLA_DATA_PATH="$(trim_value "${VALHALLA_DATA_PATH:-}")"
  HOST_PORT="$(trim_value "${HOST_PORT:-}")"
  PORT="$(trim_value "${PORT:-}")"
  ROUTER_MODE="$(trim_value "${ROUTER_MODE:-}")"
  VALHALLA_URL="$(trim_value "${VALHALLA_URL:-}")"
  VALHALLA_PREFER_PBF_REBUILD="$(trim_value "${VALHALLA_PREFER_PBF_REBUILD:-true}")"
  VALHALLA_SMART_REPAIR="$(trim_value "${VALHALLA_SMART_REPAIR:-true}")"
  NEXT_PUBLIC_APP_NAME="$(trim_value "${NEXT_PUBLIC_APP_NAME:-RogueRoute GPX}")"

  : "${VALHALLA_PREFER_PBF_REBUILD:=true}"
  : "${VALHALLA_SMART_REPAIR:=true}"
  : "${ROUTER_MODE:=direct}"
  : "${HOST_PORT:=9080}"
  : "${NEXT_PUBLIC_APP_NAME:=RogueRoute GPX}"
}

validate_boolean_env() {
  local name="$1"
  local value="${2:-}"
  case "${value,,}" in
    true|false|'') return 0 ;;
    *) fail "$name must be true or false in $ENV_FILE. Current value: $value" ;;
  esac
}

validate_env_for_mode() {
  local mode
  mode="$(normalize_mode "${1:-standard}")" || fail "Invalid mode requested for validation: ${1:-}"

  load_env_values

  [[ -n "${HOST_PORT:-}" ]] || HOST_PORT="9080"
  [[ "$HOST_PORT" =~ ^[0-9]+$ ]] || fail "HOST_PORT must be numeric in $ENV_FILE. Current value: ${HOST_PORT:-unset}"

  if [[ -n "${PORT:-}" && ! "$PORT" =~ ^[0-9]+$ ]]; then
    fail "PORT must be numeric in $ENV_FILE. Current value: ${PORT:-unset}"
  fi

  local router_mode_normalized
  router_mode_normalized="$(normalize_mode "${ROUTER_MODE:-standard}" 2>/dev/null || true)"

  case "$mode" in
    standard)
      if [[ -n "${ROUTER_MODE:-}" && "${ROUTER_MODE,,}" != "direct" && "$router_mode_normalized" == "valhalla" ]]; then
        warn "Standard mode deploy was chosen, but ROUTER_MODE in $ENV_FILE is set for Valhalla. Standard mode usually uses ROUTER_MODE=direct."
      elif [[ "${ROUTER_MODE,,}" != "direct" ]]; then
        warn "Standard mode usually uses ROUTER_MODE=direct. Current value: ${ROUTER_MODE:-unset}"
      fi
      ;;
    valhalla)
      [[ "$router_mode_normalized" == "valhalla" ]] || fail "Valhalla mode requires ROUTER_MODE=valhalla in $ENV_FILE"
      [[ -n "${VALHALLA_URL:-}" ]] || fail "VALHALLA_URL is required in $ENV_FILE for Valhalla mode"
      [[ "$VALHALLA_URL" =~ ^https?:// ]] || fail "VALHALLA_URL must start with http:// or https:// in $ENV_FILE"
      [[ -n "${VALHALLA_DATA_PATH:-}" ]] || fail "VALHALLA_DATA_PATH is required in $ENV_FILE for Valhalla mode"
      validate_boolean_env "VALHALLA_PREFER_PBF_REBUILD" "${VALHALLA_PREFER_PBF_REBUILD:-}"
      validate_boolean_env "VALHALLA_SMART_REPAIR" "${VALHALLA_SMART_REPAIR:-}"
      ;;
  esac
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
  if [[ "$json_exists" == true ]]; then
    log "valhalla.json detected"
  else
    warn "valhalla.json not found in $VALHALLA_DATA_PATH"
  fi
}

prepare_valhalla_data() {
  validate_env_for_mode valhalla
  check_valhalla_data
  verify_valhalla_outputs
}

update_repo_if_git_checkout() {
  if [[ -d "$REPO_ROOT/.git" ]] && command -v git >/dev/null 2>&1; then
    log "Git checkout detected. Pulling latest changes."
    git pull --ff-only || warn "git pull failed. Resolve manually if needed."
  else
    log "Git metadata not found. Skipping git pull because this appears to be a ZIP release."
  fi
}
