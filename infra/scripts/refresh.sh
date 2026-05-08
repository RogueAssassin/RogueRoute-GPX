#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
ensure_node_version
enable_pnpm
ensure_env_file
load_env_values
cd "$REPO_ROOT"
log "Stopping running stack"
"$REPO_ROOT/stop.sh" || true
log "Fetching latest changes"
git fetch origin
log "Resetting repo to origin/main"
git reset --hard origin/main
log "Cleaning stale repo files while preserving env and any repo-local OSRM data"
CLEAN_EXCLUDES=(-e infra/docker/.env -e infra/docker/.env.example)
if [[ -n "${OSRM_DATA_DIR:-}" ]]; then
  case "$OSRM_DATA_DIR" in
    "$REPO_ROOT"/*)
      rel_osrm_data="${OSRM_DATA_DIR#$REPO_ROOT/}"
      CLEAN_EXCLUDES+=( -e "$rel_osrm_data" -e "$rel_osrm_data/**" )
      log "Preserving repo-local OSRM data folder during git clean: $rel_osrm_data"
      ;;
  esac
fi
git clean -fdx "${CLEAN_EXCLUDES[@]}"
log "Installing dependencies"
pnpm install
log "Building workspace"
pnpm build
cd "$DOCKER_DIR"
log "Redeploying RogueRoute GPX"
docker compose up -d --build
log "Refresh complete"
