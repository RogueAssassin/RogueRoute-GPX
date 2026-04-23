#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
MODE="$(resolve_requested_mode "${1:-}")"
print_header "RogueRoute GPX v8 Build"
print_step 1 5 "Create env file if missing"
bootstrap_env_file "$MODE"
maybe_edit_env_file "$MODE"
print_step 2 5 "Check Docker and Node.js"
ensure_core_tools
ensure_node_version
ensure_env_file
validate_env_for_mode "$MODE"
log "Repo root: $REPO_ROOT"
log "Docker directory: $DOCKER_DIR"
print_step 3 5 "Prepare pnpm"
enable_pnpm
cd "$REPO_ROOT"
print_step 4 5 "Install dependencies"
pnpm install
print_step 5 5 "Build workspace"
pnpm build
log "Install/build complete"
