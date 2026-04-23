#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/infra/scripts/_common.sh"

if [[ ! -x "$SCRIPT_DIR/fix-permissions.sh" ]]; then
  chmod +x "$SCRIPT_DIR/fix-permissions.sh" 2>/dev/null || true
fi

if [ ! -x "$SCRIPT_DIR/install.sh" ] || [ ! -x "$SCRIPT_DIR/deploy.sh" ] || [ ! -x "$SCRIPT_DIR/deploy-valhalla.sh" ]; then
  bash "$SCRIPT_DIR/fix-permissions.sh" "$SCRIPT_DIR"
fi

MODE=""
MODE_LABEL="Standard"
DEPLOY_CMD="./deploy.sh"

choose_mode() {
  local input normalized
  if [[ -n "${ROGUEROUTE_MODE:-}" ]]; then
    normalized="$(normalize_mode "$ROGUEROUTE_MODE")" || fail "Invalid ROGUEROUTE_MODE: $ROGUEROUTE_MODE. Use Standard or Valhalla."
    MODE="$normalized"
  elif [[ -t 0 ]]; then
    echo
    echo "Choose deployment mode:"
    echo "  • Standard  - recommended for most users"
    echo "  • Valhalla  - advanced routing / self-hosted map engine"
    echo
    while true; do
      read -r -p "Type Standard or Valhalla [Standard]: " input
      input="${input:-Standard}"
      if normalized="$(normalize_mode "$input" 2>/dev/null)"; then
        MODE="$normalized"
        break
      fi
      warn "Invalid choice. Please type Standard or Valhalla."
    done
  else
    MODE="standard"
  fi

  if [[ "$MODE" == "valhalla" ]]; then
    MODE_LABEL="Valhalla"
    DEPLOY_CMD="./deploy-valhalla.sh"
  else
    MODE="standard"
    MODE_LABEL="Standard"
    DEPLOY_CMD="./deploy.sh"
  fi
}

print_intro() {
  print_header "RogueRoute GPX v8 Installer"
}

choose_mode
print_intro
print_step 1 6 "Select deployment mode"
print_mode_summary "$MODE"

print_step 2 6 "Create env file next to docker compose"
bootstrap_env_file "$MODE"
log "Env file location: $ENV_FILE"
maybe_edit_env_file "$MODE"

print_step 3 6 "Check host requirements"
log "Before running this installer, use: bash ./fix-permissions.sh"
log "Supported runtime for local install/build tasks: Node.js $EXPECTED_NODE_VERSION"
log "Supported package manager: pnpm $EXPECTED_PNPM_VERSION via Corepack $EXPECTED_COREPACK_VERSION"
log "Supported Docker baseline: docker $EXPECTED_DOCKER_VERSION with docker compose"
ensure_core_tools
ensure_node_version

print_step 4 6 "Install JavaScript dependencies"
enable_pnpm
cd "$REPO_ROOT"
pnpm install

if command -v pnpm >/dev/null 2>&1; then
  IGNORED_BUILDS="$(pnpm ignored-builds 2>/dev/null || true)"
  if printf '%s\n' "$IGNORED_BUILDS" | grep -qi 'sharp'; then
    warn "sharp still appears in ignored builds. Ensure pnpm-workspace.yaml contains onlyBuiltDependencies: [sharp]."
  else
    log "sharp build approval is configured via pnpm-workspace.yaml"
  fi
fi

print_step 5 6 "Build RogueRoute GPX"
pnpm build

print_step 6 6 "Ready for deployment"
if [[ "$MODE" == "valhalla" ]]; then
  validate_env_for_mode valhalla || true
  warn "Before first Valhalla deploy, confirm VALHALLA_DATA_PATH points to your real map-data folder and place your .osm.pbf files or existing tiles there."
else
  validate_env_for_mode standard || true
fi
log "Mode selected: $MODE_LABEL"
log "Next command: $DEPLOY_CMD"
log "After a reboot or crash, use ./restart.sh or ./restart-valhalla.sh"
