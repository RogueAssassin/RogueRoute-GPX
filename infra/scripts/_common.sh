#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$REPO_ROOT/infra/docker"
ENV_FILE="$DOCKER_DIR/.env"
ENV_EXAMPLE="$DOCKER_DIR/.env.example"
ENV_STANDARD="$DOCKER_DIR/.env.standard"
ENV_OSRM="$DOCKER_DIR/.env.osrm"
APP_VERSION="v10.13.0"
EXPECTED_NODE_MAJOR="24"
EXPECTED_NODE_VERSION="24.15.0"
EXPECTED_COREPACK_VERSION="0.34.7"
EXPECTED_DOCKER_VERSION="29.4.1"
EXPECTED_PNPM_VERSION="11.0.8"
EXPECTED_TYPESCRIPT_VERSION="6.0.3"

log() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[ERROR] $*"; exit 1; }

print_header() { local title="${1:-RogueRoute GPX}"; printf '\n╔════════════════════════════════════════════╗\n║ %-42s ║\n╚════════════════════════════════════════════╝\n' "$title"; }
print_step() { printf '\n[%s/%s] %s\n' "$1" "$2" "$3"; }

print_mode_summary() {
  local mode="${1:-osrm}"
  case "$mode" in
    osrm)
      echo "Mode selected: OSRM"
      echo "Audience: advanced / quality routing users"
      echo "Focus: road, sidewalk, path, and footway-following GPX using local OSM data"
      ;;
    *)
      echo "Mode selected: Standard"
      echo "Audience: web-only testing / emergency fallback"
      echo "Focus: lowest resource use; direct routing only"
      ;;
  esac
}

trim_value() { local raw="${1:-}"; raw="${raw#"${raw%%[![:space:]]*}"}"; raw="${raw%"${raw##*[![:space:]]}"}"; printf '%s' "$raw"; }

normalize_mode() {
  local raw normalized
  raw="$(trim_value "${1:-osrm}")"; normalized="${raw,,}"
  case "$normalized" in
    ""|osrm|routing) echo "osrm" ;;
    standard|std|direct) echo "standard" ;;
    *) return 1 ;;
  esac
}

get_env_router_mode() {
  [[ -f "$ENV_FILE" ]] || { echo ""; return 0; }
  local raw; raw="$(grep -E '^ROUTER_MODE=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"; raw="$(trim_value "$raw")"
  case "${raw,,}" in osrm) echo osrm ;; direct|standard|std) echo standard ;; *) echo "" ;; esac
}

resolve_requested_mode() {
  [[ -n "${1:-}" ]] && { normalize_mode "$1"; return 0; }
  [[ -n "${ROGUEROUTE_MODE:-}" ]] && { normalize_mode "$ROGUEROUTE_MODE"; return 0; }
  local detected; detected="$(get_env_router_mode)"; [[ -n "$detected" ]] && echo "$detected" || echo osrm
}

find_editor() { for candidate in "${EDITOR:-}" nano vi vim; do [[ -n "$candidate" ]] && command -v "$candidate" >/dev/null 2>&1 && { echo "$candidate"; return 0; }; done; return 1; }

maybe_edit_env_file() {
  [[ -f "$ENV_FILE" && -t 0 ]] || return 0
  local mode; mode="$(normalize_mode "${1:-osrm}")" || fail "Invalid mode for env edit: ${1:-}"
  local prompt="Edit infra/docker/.env now before continuing? [y/N]: " default_reply="N"
  if [[ "$mode" == "osrm" ]]; then prompt="Edit infra/docker/.env now to confirm OSRM_DATA_DIR / OSRM_PBF? [Y/n]: "; default_reply="Y"; fi
  local reply editor; read -r -p "$prompt" reply || true; reply="${reply:-$default_reply}"
  case "${reply,,}" in y|yes) if editor="$(find_editor)"; then "$editor" "$ENV_FILE"; load_env_values; else warn "No terminal editor found. Update $ENV_FILE manually."; fi ;; esac
}


set_env_var() {
  local key="$1" value="$2" file="${3:-$ENV_FILE}"
  mkdir -p "$(dirname "$file")"
  touch "$file"
  if grep -qE "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

ensure_osm_region_env_catalog() {
  [[ -f "$REPO_ROOT/scripts/osm-region-catalog.sh" ]] || return 0
  # shellcheck disable=SC1091
  source "$REPO_ROOT/scripts/osm-region-catalog.sh"
  set_env_var OSRM_ACTIVE_REGION "${OSRM_ACTIVE_REGION:-australia}"
  set_env_var OSRM_SWITCH_ENABLED "${OSRM_SWITCH_ENABLED:-true}"
  set_env_var OSRM_SWITCH_SCRIPT "${OSRM_SWITCH_SCRIPT:-/host/rogueroute/switch-osrm-region.sh}"
  echo "$OSM_REGION_CATALOG" | while IFS='|' read -r key label url graph rough expanded priority; do
    [[ -z "$key" ]] && continue
    local var_name
    var_name="$(region_env_name "$key")"
    set_env_var "$var_name" "${graph}-latest.osm.pbf"
  done
}

bootstrap_env_file() {
  local mode; mode="$(normalize_mode "${1:-osrm}")" || fail "Invalid mode: ${1:-}. Use osrm or standard."
  [[ -f "$ENV_FILE" ]] && { ensure_osm_region_env_catalog; configure_env_for_mode "$mode"; log "Reusing existing env file: $ENV_FILE"; return 0; }
  local template="$ENV_OSRM"; [[ "$mode" == "standard" ]] && template="$ENV_STANDARD"
  [[ -f "$template" ]] || fail "Missing env template: $template"
  cp "$template" "$ENV_FILE"
  ensure_osm_region_env_catalog
  configure_env_for_mode "$mode"
  log "Created $ENV_FILE from $(basename "$template")"
}

configure_env_for_mode() {
  local mode; mode="$(normalize_mode "${1:-osrm}")" || fail "Invalid mode: ${1:-}"
  case "$mode" in
    osrm)
      set_env_var ROUTER_MODE osrm
      set_env_var OSRM_URL "${OSRM_URL:-http://osrm:5000}"
      ;;
    standard)
      set_env_var ROUTER_MODE direct
      ;;
  esac
}

ensure_command() { command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"; }
ensure_core_tools() { ensure_command docker; docker compose version >/dev/null 2>&1 || fail "docker compose is not available"; }
ensure_env_file() { [[ -f "$ENV_FILE" ]] || fail "Missing $ENV_FILE. Run ./first-run.sh or ./deploy.sh."; }
ensure_media_net() { if ! docker network inspect media-net >/dev/null 2>&1; then warn "Docker network 'media-net' does not exist yet. Creating it now."; docker network create media-net >/dev/null; fi; }

load_nvm_if_available() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
}

ensure_node_version() {
  load_nvm_if_available
  if command -v nvm >/dev/null 2>&1; then
    nvm install "$EXPECTED_NODE_VERSION" >/dev/null
    nvm use "$EXPECTED_NODE_VERSION" >/dev/null
  fi
  ensure_command node
  local detected; detected="$(node -v 2>/dev/null || true)"
  [[ "$detected" == "v$EXPECTED_NODE_VERSION" ]] || fail "Node.js v$EXPECTED_NODE_VERSION is required exactly. Detected: ${detected:-unknown}. Run: nvm install $EXPECTED_NODE_VERSION && nvm use $EXPECTED_NODE_VERSION. Avoid sudo because sudo usually hides nvm."
}

enable_pnpm() {
  if command -v corepack >/dev/null 2>&1; then
    log "Preparing pnpm via Corepack (pnpm@$EXPECTED_PNPM_VERSION)"
    corepack enable >/dev/null 2>&1 || true
    corepack prepare "pnpm@$EXPECTED_PNPM_VERSION" --activate >/dev/null 2>&1 || true
  else
    warn "Corepack not found. pnpm must already be installed manually."
  fi
  command -v pnpm >/dev/null 2>&1 || fail "pnpm is not available. Run: sudo npm install -g pnpm@$EXPECTED_PNPM_VERSION"
}

load_env_values() {
  [[ -f "$ENV_FILE" ]] || return 0
  HOST_PORT=$(grep -E '^HOST_PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  PORT=$(grep -E '^PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  ROUTER_MODE=$(grep -E '^ROUTER_MODE=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  OSRM_URL=$(grep -E '^OSRM_URL=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  OSRM_PROFILE=$(grep -E '^OSRM_PROFILE=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  OSRM_DATA_DIR=$(grep -E '^OSRM_DATA_DIR=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  OSRM_PBF=$(grep -E '^OSRM_PBF=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  OSRM_GRAPH=$(grep -E '^OSRM_GRAPH=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  OSRM_SNAP_RADIUS_METERS=$(grep -E '^OSRM_SNAP_RADIUS_METERS=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  OSRM_THREADS=$(grep -E '^OSRM_THREADS=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  OSRM_ACTIVE_REGION=$(grep -E '^OSRM_ACTIVE_REGION=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  NEXT_PUBLIC_APP_NAME=$(grep -E '^NEXT_PUBLIC_APP_NAME=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
  HOST_PORT="$(trim_value "${HOST_PORT:-9080}")"; PORT="$(trim_value "${PORT:-9080}")"; ROUTER_MODE="$(trim_value "${ROUTER_MODE:-osrm}")"
  OSRM_URL="$(trim_value "${OSRM_URL:-http://osrm:5000}")"; OSRM_PROFILE="$(trim_value "${OSRM_PROFILE:-foot}")"; OSRM_DATA_DIR="$(trim_value "${OSRM_DATA_DIR:-/mnt/h/osrm}")"
  OSRM_PBF="$(trim_value "${OSRM_PBF:-planet.osm.pbf}")"; OSRM_GRAPH="$(trim_value "${OSRM_GRAPH:-planet.osrm}")"; OSRM_SNAP_RADIUS_METERS="$(trim_value "${OSRM_SNAP_RADIUS_METERS:-250}")"; OSRM_THREADS="$(trim_value "${OSRM_THREADS:-8}")"; OSRM_ACTIVE_REGION="$(trim_value "${OSRM_ACTIVE_REGION:-australia}")"
  NEXT_PUBLIC_APP_NAME="$(trim_value "${NEXT_PUBLIC_APP_NAME:-RogueRoute-GPX}")"
}

validate_env_for_mode() {
  local mode; mode="$(normalize_mode "${1:-osrm}")" || fail "Invalid mode requested: ${1:-}"
  load_env_values
  [[ "$HOST_PORT" =~ ^[0-9]+$ ]] || fail "HOST_PORT must be numeric in $ENV_FILE. Current: ${HOST_PORT:-unset}"
  [[ -z "${PORT:-}" || "$PORT" =~ ^[0-9]+$ ]] || fail "PORT must be numeric in $ENV_FILE. Current: ${PORT:-unset}"
  case "$mode" in
    osrm)
      [[ "${ROUTER_MODE,,}" == "osrm" ]] || fail "OSRM mode requires ROUTER_MODE=osrm in $ENV_FILE"
      [[ "$OSRM_URL" =~ ^https?:// ]] || fail "OSRM_URL must start with http:// or https://"
      [[ "$OSRM_PROFILE" =~ ^(foot|bike|car)$ ]] || fail "OSRM_PROFILE must be foot, bike, or car"
      [[ -n "$OSRM_DATA_DIR" ]] || fail "OSRM_DATA_DIR is required"
      [[ -n "$OSRM_PBF" ]] || fail "OSRM_PBF is required"
      [[ -n "$OSRM_GRAPH" ]] || fail "OSRM_GRAPH is required"
      [[ "$OSRM_THREADS" =~ ^[0-9]+$ ]] || fail "OSRM_THREADS must be numeric"
      ;;
    standard)
      [[ "${ROUTER_MODE,,}" == "direct" ]] || warn "Standard mode usually uses ROUTER_MODE=direct. Current: ${ROUTER_MODE:-unset}"
      ;;
  esac
}

check_port_free() { local port="$1"; [[ -n "$port" ]] || return 0; ss -tulpn 2>/dev/null | grep -q ":$port\b" && warn "Port $port appears to be in use. Review with: sudo ss -tulpn | grep :$port" || true; }

ensure_osrm_mount_available() {
  load_env_values
  [[ -d "$OSRM_DATA_DIR" ]] || fail "OSRM_DATA_DIR does not exist: $OSRM_DATA_DIR"
  if command -v findmnt >/dev/null 2>&1 && ! findmnt "$OSRM_DATA_DIR" >/dev/null 2>&1; then
    warn "OSRM_DATA_DIR exists but does not appear as its own mounted filesystem. Confirm /mnt/h is active before planet builds."
  fi
}

check_osrm_data() {
  load_env_values; ensure_osrm_mount_available
  [[ -f "$OSRM_DATA_DIR/$OSRM_PBF" ]] || fail "Missing OSRM input PBF: $OSRM_DATA_DIR/$OSRM_PBF"
}

verify_osrm_outputs() {
  load_env_values; ensure_osrm_mount_available
  log "OSRM data dir: $OSRM_DATA_DIR"
  log "Input PBF: $OSRM_PBF"
  log "Graph: $OSRM_GRAPH"
  [[ -f "$OSRM_DATA_DIR/$OSRM_PBF" ]] && log "PBF detected: $(du -h "$OSRM_DATA_DIR/$OSRM_PBF" | awk '{print $1}')" || warn "PBF missing: $OSRM_DATA_DIR/$OSRM_PBF"
  if [[ -f "$OSRM_DATA_DIR/$OSRM_GRAPH" ]]; then
    log "OSRM graph detected: $(du -h "$OSRM_DATA_DIR/$OSRM_GRAPH" | awk '{print $1}')"
  else
    warn "OSRM graph missing: $OSRM_DATA_DIR/$OSRM_GRAPH. Run ./prepare-osrm.sh"
  fi
  local count; count=$(find "$OSRM_DATA_DIR" -maxdepth 1 -name "${OSRM_GRAPH%.osrm}.osrm*" | wc -l | tr -d ' ')
  log "OSRM sidecar files detected: $count"
}

prepare_osrm_data() { validate_env_for_mode osrm; check_osrm_data; verify_osrm_outputs; }

clean_web_build_artifacts() {
  local stopped_only="${1:-true}"
  if [[ "$stopped_only" == "true" ]] && docker ps --format '{{.Names}}' | grep -qx 'gpx-web'; then
    fail "gpx-web is still running. Stop it first with ./stop.sh, then rerun cleanup."
  fi
  log "Removing stale web build artifacts"
  rm -rf "$REPO_ROOT/apps/gpx-web/.next" "$REPO_ROOT/apps/gpx-web/out"
  rm -rf "$REPO_ROOT/apps/gpx-web/tsconfig.tsbuildinfo"
}

clean_stale_docker_builders() {
  log "Pruning dangling RogueRoute GPX Docker build cache"
  docker builder prune -f --filter type=exec.cachemount >/dev/null 2>&1 || true
}

print_restart_help() {
  log "Restart complete. Open http://SERVER-IP:${HOST_PORT:-9080} or run ./status.sh to verify containers."
}

runtime_sparse_paths() {
  cat <<'EOF'
apps
packages
plugins
infra
scripts
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig.base.json
.npmrc
.nvmrc
.node-version
.dockerignore
.gitignore
VERSION
first-run.sh
install.sh
deploy.sh
update.sh
restart.sh
refresh.sh
status.sh
stop.sh
logs.sh
doctor.sh
download-osm.sh
prepare-osrm.sh
prepare-osm.sh
switch-osrm-region.sh
verify-osrm.sh
fix-permissions.sh
clean-web.sh
version-check.sh
release.sh
EOF
}

configure_runtime_sparse_checkout() {
  [[ -d "$REPO_ROOT/.git" ]] || return 0
  [[ "${ROGUEROUTE_FULL_CHECKOUT:-false}" == "true" ]] && { log "Full checkout requested; sparse checkout disabled."; return 0; }
  command -v git >/dev/null 2>&1 || return 0
  cd "$REPO_ROOT"
  if ! git sparse-checkout list >/dev/null 2>&1; then
    log "Enabling runtime-only sparse checkout. Docs/README/release workspace stay on GitHub."
    git sparse-checkout init --cone >/dev/null 2>&1 || true
  else
    log "Refreshing runtime-only sparse checkout paths."
  fi
  mapfile -t _runtime_paths < <(runtime_sparse_paths)
  git sparse-checkout set --cone "${_runtime_paths[@]}" >/dev/null 2>&1 || warn "Could not apply sparse checkout. Continuing with existing checkout."
}

update_repo_if_git_checkout() {
  if [[ -d "$REPO_ROOT/.git" ]] && command -v git >/dev/null 2>&1; then
    log "Git checkout detected. Pulling latest runtime files."
    configure_runtime_sparse_checkout
    cd "$REPO_ROOT"
    git pull --ff-only || warn "git pull failed. Resolve manually if needed."
  else
    log "Git metadata not found. Skipping git pull because this appears to be a ZIP release."
  fi
}
