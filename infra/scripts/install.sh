#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
ensure_node_version
log "Repo root: $REPO_ROOT"
log "Docker directory: $DOCKER_DIR"
enable_pnpm
cd "$REPO_ROOT"
log "Installing dependencies"
pnpm install
log "Building workspace"
pnpm build
log "Install/build complete"
